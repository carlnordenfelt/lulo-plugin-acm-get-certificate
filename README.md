# lulo ACM Get Certificate

lulo ACM Get Certificate gets the certificate ARN from ACM for a specific domain name.

lulo ACM Get Certificate is a [lulo](https://github.com/carlnordenfelt/lulo) plugin

# Installation
```
npm install lulo-plugin-acm-get-certificate --save
```

## Usage
### Properties
* DomainName: The Domain name you want to match. Note that this must be the primary domain name of the certificate.
* CertificateStatuses: An array of certificate statuses to consider. Optional. Default is 'ISSUED'. For a list of valid statuses, please see [the SDK documentation](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/ACM.html#listCertificates-property)
* Region: Override the AWS Region from where to list certificates. Useful when getting CloudFront certificates which have to be issued in us-east-1. Optional. Default is where the CustomResource is deployed.

### Return Values
When the logical ID of this resource is provided to the Ref intrinsic function, Ref returns the ARN of the certificate.

`{ "Ref": "AcmCertificateArn" }`

**Note:** If more than one certificate matches the domain name, the first match is returned.

**Note:** If no matching certificate is found, an error is returned.

### Required IAM Permissions
The Custom Resource Lambda requires the following permission statement for this plugin to work:
```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Stmt1481186942626",
      "Action": [
        "acm:ListCertificates"
      ],
      "Effect": "Allow",
      "Resource": "*"
    }
  ]
}
```

## License
[The MIT License (MIT)](/LICENSE)

## Change Log
[Change Log](/CHANGELOG.md)
