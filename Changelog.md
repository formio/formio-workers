# Change Log
All notable changes to this project will be documented in this file

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## 1.16.5-rc.2
### Changed
 - Upgrade formiojs@4.14.5-rc.4

## 1.16.5-rc.1
### Changed
 - Upgrade formiojs@4.14.5-rc.3

## 1.16.3
### Added
 - A way to force the rendering method with an environment variable.

## 1.16.2
### Fixed
 - Fixed issues with working with macros.

## 1.16.0
### Changed
 - Official Release

## 1.16.0-rc.2
### Fixed
 - FIO-3783: Fixed issues with the processing of emails.

### Changed
 - Upgrade vm2@3.9.5, eslint@8.0.1, mocha@9.1.3

## 1.16.0-rc.1
### Changed
 - FIO-3308: fixed an issue where email submission data is empty for checkbox of radio type with configured name
 - FIO-3783: Added dynamic rendering

## 1.14.16
### Changed
 - Made other fixes to sanitize methods.

## 1.14.15
### Fixed
 - Ensure we delete private contexts.

## 1.14.14
### Fixed
 - Refactored nunjucks interpreter for higher performance and added security.

## 1.14.13
### Fixed
 - Cloning sandbox context for added protection.

## 1.14.12
### Fixed
 - Issues where complex data objects would make the email not send.

## 1.14.11
### Changed
 - Refactored library to use workers and vm2

## 1.14.10
### Fixed
 - Issue where the template service would not run within a vm.

## 1.14.9
### Fixed
 - Wrapped values with shorthand of nunjucks raw tag to output plain text

## 1.14.8
### Fixed
 - Issue with the email tables not closing the td tag.

## 1.14.7
### Fixed
 - FJS-911: Date/Time data in email is displaying two times.

## v1.14.6
### Fixed
 - Problems with datagrid and editgrid emails.

## v1.14.5
### Fixed
 - Issues with the templates not rending root panels in emails.

## v1.14.4
### Fixed
 - Ensure that the email service will not crash.

## v1.14.3
### Fixed
 - Address component issues.

## v1.14.1
### Fixed
 - Issues with email rendering for the new address component.

## v1.14.0
### Fixed
 - FOR-2367: Use labels instead of values when printing the survey component in emails.
 - FOR-2499: Encourage browser to treat download links as file downloads

### Changed
 -

## v1.13.0
### Fixed
 - Issue where file components could crash the email template handling code.

## v1.8.0
### Fixes
 - Problems with bringing in older formiojs lib.
 - Problems with including "clone" module that does not exist.

## v1.7.0
### Fixes
 - FOR-1429: Add editgrid support for email rendering.

### Changes
 - Upgraded claudia@5.1.1, aws-serverless-express@3.3.5, formiojs@3.5.3
