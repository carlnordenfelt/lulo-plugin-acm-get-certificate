'use strict';

let expect  = require('chai').expect;
let mockery = require('mockery');
let sinon   = require('sinon');

describe('Index unit tests', function () {
    let subject;
    let listCertificatesStub    = sinon.stub();
    let describeCertificateStub = sinon.stub();
    let configUpdateStub        = sinon.stub();
    let event;

    before(function () {
        mockery.enable({
            useCleanCache:      true,
            warnOnUnregistered: false
        });

        let awsSdkStub = {
            ACM:    function () {
                this.listCertificates    = listCertificatesStub;
                this.describeCertificate = describeCertificateStub;
            },
            config: {
                update: configUpdateStub
            }
        };

        mockery.registerMock('aws-sdk', awsSdkStub);
        subject = require('../../src/index');
    });
    beforeEach(function () {
        listCertificatesStub.reset();
        listCertificatesStub.yields(null, {
            CertificateSummaryList: [
                {DomainName: 'something else', CertificateArn: 'CertificateArnNoMatch'},
                {DomainName: 'DomainName', CertificateArn: 'CertificateArn'}
            ]
        });
        configUpdateStub.reset();
        event = {
            ResourceProperties: {
                DomainName:                 'DomainName',
                ConflictResolutionStrategy: 'FIRST'
            }
        };
    });
    after(function () {
        mockery.deregisterAll();
        mockery.disable();
    });

    describe('validate', function () {
        it('should succeed', function (done) {
            subject.validate(event);
            done();
        });
        it('should succeed without ConflictResolutionStrategy', function (done) {
            delete event.ResourceProperties.ConflictResolutionStrategy;
            subject.validate(event);
            done();
        });
        it('should fail if DomainName is not set', function (done) {
            delete event.ResourceProperties.DomainName;

            function fn() {
                subject.validate(event);
            }

            expect(fn).to.throw(/Missing required property DomainName/);
            done();
        });
        it('should fail if ConflictResolutionStrategy has invalid value', function (done) {
            event.ResourceProperties.ConflictResolutionStrategy = 'INVALID';

            function fn() {
                subject.validate(event);
            }

            expect(fn).to.throw('Invalid ConflictResolutionStrategy');
            done();
        });
    });

    describe('create with conflict FIRST', function () {
        beforeEach(function () {
            event.ResourceProperties.ConflictResolutionStrategy = 'FIRST';
        });
        it('should succeed ', function (done) {
            subject.create(event, {}, function (error, response) {
                expect(error).to.equal(null);
                expect(response.physicalResourceId).to.equal('CertificateArn');
                expect(listCertificatesStub.calledOnce).to.equal(true);
                expect(configUpdateStub.called).to.equal(false);
                expect(describeCertificateStub.called).to.equal(false);
                done();
            });
        });
        it('should succeed with region override', function (done) {
            event.ResourceProperties.Region = 'us-east-1';
            subject.create(event, {}, function (error, response) {
                expect(error).to.equal(null);
                expect(response.physicalResourceId).to.equal('CertificateArn');
                expect(listCertificatesStub.calledOnce).to.equal(true);
                expect(configUpdateStub.calledOnce).to.equal(true);
                expect(describeCertificateStub.called).to.equal(false);
                done();
            });
        });
        it('should succeed with status filter enabled', function (done) {
            event.ResourceProperties.CertificateStatuses = ['TEST'];
            subject.create(event, {}, function (error, response) {
                expect(error).to.equal(null);
                expect(response.physicalResourceId).to.equal('CertificateArn');
                expect(listCertificatesStub.calledOnce).to.equal(true);
                expect(describeCertificateStub.called).to.equal(false);
                done();
            });
        });
        it('should succeed with recursive list calls', function (done) {
            listCertificatesStub.onFirstCall().yields(null, {
                CertificateSummaryList: [{}],
                NextToken:              'NextToken'
            });
            listCertificatesStub.onSecondCall().yields(null, {
                CertificateSummaryList: [
                    {},
                    {DomainName: 'DomainName', CertificateArn: 'CertificateArn'}
                ]
            });
            subject.create(event, {}, function (error, response) {
                expect(error).to.equal(null);
                expect(response.physicalResourceId).to.equal('CertificateArn');
                expect(listCertificatesStub.calledTwice).to.equal(true);
                expect(describeCertificateStub.called).to.equal(false);
                done();
            });
        });
        it('should fail due to no certificate found error', function (done) {
            listCertificatesStub.yields(null, {
                CertificateSummaryList: [{}]
            });
            subject.create(event, {}, function (error, response) {
                expect(error.message).to.contain('not found');
                expect(response).to.equal(undefined);
                expect(listCertificatesStub.calledOnce).to.equal(true);
                expect(describeCertificateStub.called).to.equal(false);
                done();
            });
        });
        it('should fail due to listCertificates error', function (done) {
            listCertificatesStub.yields('listCertificates');
            subject.create(event, {}, function (error, response) {
                expect(error).to.equal('listCertificates');
                expect(response).to.equal(undefined);
                expect(listCertificatesStub.calledOnce).to.equal(true);
                expect(describeCertificateStub.called).to.equal(false);
                done();
            });
        });
    });

    describe('create with conflict NEWEST', function () {
        beforeEach(function () {
            event.ResourceProperties.ConflictResolutionStrategy = 'NEWEST';
            listCertificatesStub.yields(null, {
                CertificateSummaryList: [
                    {DomainName: 'DomainName', CertificateArn: 'CertificateArn1'},
                    {DomainName: 'DomainName', CertificateArn: 'CertificateArn2'},
                    {DomainName: 'DomainName', CertificateArn: 'CertificateArn3'}
                ]
            });
            describeCertificateStub.reset();
        });
        it('should succeed when only finding one match', function (done) {
            listCertificatesStub.yields(null, {
                CertificateSummaryList: [
                    {DomainName: 'AnotherDomain', CertificateArn: 'CertificateArn1'},
                    {DomainName: 'DomainName', CertificateArn: 'CertificateArn2'}
                ]
            });
            subject.create(event, {}, function (error, response) {
                expect(error).to.equal(null);
                expect(response.physicalResourceId).to.equal('CertificateArn2');
                expect(listCertificatesStub.calledOnce).to.equal(true);
                expect(configUpdateStub.called).to.equal(false);
                expect(describeCertificateStub.called).to.equal(false);
                done();
            });
        });
        it('should succeed when finding more than match returning newest', function (done) {
            describeCertificateStub.onFirstCall().yields(null, {
                Certificate: {
                    ImportedAt:      Date.now(),
                    CertificateArn: 'CertificateArn1'
                }
            });
            describeCertificateStub.onSecondCall().yields(null, {
                Certificate: {
                    ImportedAt:     Date.now() + 1,
                    CertificateArn: 'CertificateArn2'
                }
            });
            describeCertificateStub.yields(null, {
                Certificate: {
                    CreatedAt:      1,
                    ImportedAt:      1,
                    CertificateArn: 'CertificateArn3'
                }
            });

            subject.create(event, {}, function (error, response) {
                expect(error).to.equal(null);
                expect(response.physicalResourceId).to.equal('CertificateArn2');
                expect(listCertificatesStub.calledOnce).to.equal(true);
                expect(configUpdateStub.called).to.equal(false);
                expect(describeCertificateStub.called).to.equal(true);
                done();
            });
        });

        it('should fail on describeCertificate error', function (done) {
            describeCertificateStub.yields('describeCertificateStub');

            subject.create(event, {}, function (error, response) {
                expect(error).to.equal('describeCertificateStub');
                expect(response).to.equal(undefined);
                expect(listCertificatesStub.calledOnce).to.equal(true);
                expect(configUpdateStub.called).to.equal(false);
                expect(describeCertificateStub.called).to.equal(true);
                done();
            });
        });

    });

    describe('update', function () {
        it('should succeed', function (done) {
            subject.update(event, {}, function (error, response) {
                expect(error).to.equal(null);
                expect(response.physicalResourceId).to.equal('CertificateArn');
                expect(listCertificatesStub.calledOnce).to.equal(true);
                done();
            });
        });
    });

    describe('delete', function () {
        it('should succeed', function (done) {
            subject.delete(event, {}, function (error, response) {
                expect(error).to.equal(undefined);
                expect(response).to.equal(undefined);
                expect(listCertificatesStub.called).to.equal(false);
                done();
            });
        });
    });
});
