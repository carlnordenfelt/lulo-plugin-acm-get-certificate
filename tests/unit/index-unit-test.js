'use strict';

var expect = require('chai').expect;
var mockery = require('mockery');
var sinon = require('sinon');

describe('Index unit tests', function () {
    var subject;
    var listCertificatesStub = sinon.stub();
    var configUpdateStub = sinon.stub();
    var event;

    before(function () {
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        });

        var awsSdkStub = {
            ACM: function () {
                this.listCertificates = listCertificatesStub;
            },
            config: {
                update: configUpdateStub
            }
        };

        mockery.registerMock('aws-sdk', awsSdkStub);
        subject = require('../../src/index');
    });
    beforeEach(function () {
        listCertificatesStub.reset().resetBehavior();
        listCertificatesStub.yields(null, { CertificateSummaryList: [
            {},
            { DomainName: 'DomainName', CertificateArn: 'CertificateArn' }
        ]});
        configUpdateStub.reset();
        event = {
            ResourceProperties: {
                DomainName: 'DomainName'
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
        it('should fail if DomainName is not set', function (done) {
            delete event.ResourceProperties.DomainName;
            function fn () {
                subject.validate(event);
            }
            expect(fn).to.throw(/Missing required property DomainName/);
            done();
        });
    });

    describe('create', function () {
        it('should succeed', function (done) {
            subject.create(event, {}, function (error, response) {
                expect(error).to.equal(null);
                expect(response.physicalResourceId).to.equal('CertificateArn');
                expect(listCertificatesStub.calledOnce).to.equal(true);
                expect(configUpdateStub.called).to.equal(false);
                done();
            });
        });it('should succeed with region override', function (done) {
            event.ResourceProperties.Region = 'us-east-1';
            subject.create(event, {}, function (error, response) {
                expect(error).to.equal(null);
                expect(response.physicalResourceId).to.equal('CertificateArn');
                expect(listCertificatesStub.calledOnce).to.equal(true);
                expect(configUpdateStub.calledOnce).to.equal(true);
                done();
            });
        });
        it('should succeed with status filter enabled', function (done) {
            event.ResourceProperties.CertificateStatuses = ['TEST'];
            subject.create(event, {}, function (error, response) {
                expect(error).to.equal(null);
                expect(response.physicalResourceId).to.equal('CertificateArn');
                expect(listCertificatesStub.calledOnce).to.equal(true);
                done();
            });
        });
        it('should succeed with recursive list calls', function (done) {
            listCertificatesStub.onFirstCall().yields(null, {
                CertificateSummaryList: [{}],
                NextToken: 'NextToken'
            });
            listCertificatesStub.onSecondCall().yields(null, { CertificateSummaryList: [
                {},
                { DomainName: 'DomainName', CertificateArn: 'CertificateArn' }
            ]});
            subject.create(event, {}, function (error, response) {
                expect(error).to.equal(null);
                expect(response.physicalResourceId).to.equal('CertificateArn');
                expect(listCertificatesStub.calledTwice).to.equal(true);
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
                done();
            });
        });
        it('should fail due to listCertificates error', function (done) {
            listCertificatesStub.yields('listCertificates');
            subject.create(event, {}, function (error, response) {
                expect(error).to.equal('listCertificates');
                expect(response).to.equal(undefined);
                expect(listCertificatesStub.calledOnce).to.equal(true);
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
