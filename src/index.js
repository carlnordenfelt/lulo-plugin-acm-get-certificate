'use strict';

var aws = require('aws-sdk');
var acm = new aws.ACM({ apiVersion: '2015-12-08' });

var pub = {};

pub.validate = function (event) {
    if (!event.ResourceProperties.DomainName) {
        throw new Error('Missing required property DomainName');
    }
};

pub.create = function (event, _context, callback) {
    getCertificate(
        event.ResourceProperties.DomainName,
        event.ResourceProperties.CertificateStatuses,
        null,
        callback
    );
};

pub.update = function (event, context, callback) {
    return pub.create(event, context, callback);
};

pub.delete = function (_event, _context, callback) {
    setImmediate(callback);
};

module.exports = pub;

function getCertificate(domainName, statuses, nextToken, callback) {
    var params = {};
    if (statuses) {
        params.CertificateStatuses = statuses;
    } else {
        params.CertificateStatuses = ['ISSUED'];
    }
    if (nextToken) {
        params.NextToken = nextToken;
    }
    acm.listCertificates(params, function (error, response) {
        if (error) {
            return callback(error);
        }

        var certificate;
        for (var i = 0; i < response.CertificateSummaryList.length; i++) {
            if (response.CertificateSummaryList[i].DomainName === domainName) {
                certificate = response.CertificateSummaryList[i];
                break;
            }
        }

        if (certificate) {
            var data = {
                physicalResourceId: certificate.CertificateArn
            };
            return callback(null, data);
        } else if (response.NextToken) {
            return getCertificate(domainName, statuses, response.NextToken, callback);
        }
        return callback(new Error('Certificate resource for ' + domainName + ' not found'));
    });
}