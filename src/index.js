'use strict';

const aws   = require('aws-sdk');
const async = require('async');
let acm;

const pub                   = {};
const RESOLUTION_STRATEGIES = ['FIRST', 'NEWEST'];

pub.validate = function (event) {
    if (!event.ResourceProperties.DomainName) {
        throw new Error('Missing required property DomainName');
    }

    if (!event.ResourceProperties.ConflictResolutionStrategy) {
        event.ResourceProperties.ConflictResolutionStrategy = RESOLUTION_STRATEGIES[0];
    }

    if (RESOLUTION_STRATEGIES.indexOf(event.ResourceProperties.ConflictResolutionStrategy) === -1) {
        throw new Error('Invalid ConflictResolutionStrategy: ' + event.ResourceProperties.ConflictResolutionStrategy + '. ' +
            'Valid values are ' + JSON.stringify(RESOLUTION_STRATEGIES));
    }
};

pub.create = function (event, _context, callback) {
    if (event.ResourceProperties.Region) {
        aws.config.update({region: event.ResourceProperties.Region});
        delete event.ResourceProperties.Region;
    }
    acm = new aws.ACM({apiVersion: '2015-12-08'});

    let conflictResolutionStrategy = event.ResourceProperties.ConflictResolutionStrategy;
    delete event.ResourceProperties.ConflictResolutionStrategy;
    let domainName = event.ResourceProperties.DomainName;
    delete event.ResourceProperties.DomainName;

    getCertificates(domainName, event.ResourceProperties, conflictResolutionStrategy, null, [], callback);
};

pub.update = function (event, context, callback) {
    return pub.create(event, context, callback);
};

pub.delete = function (_event, _context, callback) {
    setImmediate(callback);
};

module.exports = pub;

/* eslint-disable max-params */
function getCertificates(domainName, params, conflictResolutionStrategy, nextToken, matchingCertificates, callback) {
    if (!params.CertificateStatuses) {
        params.CertificateStatuses = ['ISSUED'];
    }
    if (nextToken) {
        params.NextToken = nextToken;
    }

    acm.listCertificates(params, function (error, response) {
        if (error) {
            return callback(error);
        }

        for (let certificate of response.CertificateSummaryList) {
            if (certificate.DomainName === domainName) {
                if (conflictResolutionStrategy === RESOLUTION_STRATEGIES[0]) { // First
                    let data = {
                        physicalResourceId: certificate.CertificateArn
                    };
                    // Exit early, we found one certificate and are good to go since we resolve duplicates by first
                    return callback(null, data);
                }

                matchingCertificates.push(certificate);
            }
        }

        if (response.NextToken) {
            return getCertificates(domainName, params, conflictResolutionStrategy, response.NextToken, matchingCertificates, callback);
        } else if (matchingCertificates.length === 0) {
            return callback(new Error('Certificate resource for ' + domainName + ' not found'));
        } else if (matchingCertificates.length === 1) {
            let data = {
                physicalResourceId: matchingCertificates[0].CertificateArn
            };
            return callback(null, data);
        }

        // Found more than one certificate, resolve the conflict by giving back the newest first so we have to describe them.
        async.mapSeries(matchingCertificates, function (certificate, next) {
            const params = {
                CertificateArn: certificate.CertificateArn
            };
            acm.describeCertificate(params, function (error, result) {
                if (error) {
                    return next(error);
                }

                return next(null, result.Certificate);
            });
        }, function (error, results) {
            if (error) {
                return callback(error);
            }

            let arn       = null;
            let createdAt = null;

            for (let certificate of results) {
                if (certificate.CreatedAt >= createdAt || certificate.ImportedAt >= createdAt) {
                    createdAt = certificate.CreatedAt || certificate.ImportedAt;
                    arn       = certificate.CertificateArn;
                }
            }

            let data = {
                physicalResourceId: arn
            };
            return callback(null, data);
        });
    });
}
