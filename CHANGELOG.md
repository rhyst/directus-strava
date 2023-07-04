# Changelog

All notable changes to this project will be documented in this file. A "⚠️" emoji denotes a potentially breaking change.

## [2.0.0] - 2023-04-07

### Changed

- ⚠️ Config file is now a ES module not a CommonJS module
- Updated dependencies

### Other

- Updated project to use the official directus extension scaffolding and CLI tool

## [1.6.0] - 2022-11-30

### Changed

- Bumped express version
- Temporarily avoid using JSON field filtering as directus removed support for it

### Fixed

- Include mime type in GPX upload

## [1.5.0] - 2022-06-09

### Changed

- Combined activities list into main page
- Remove all code and documentation related to subscribing to changes
- Improved logging output


## [1.4.0] - 2022-01-03

### Changed

- Add option to disable requirement for directus authentication cookie if you want to use some other method

### Fixed

- Remove unused options from README
  
## [1.3.1] - 2021-11-27

### Fixed

- Webhook subscription not working due to lack of auth cookie

## [1.3.0] - 2021-11-17

### Changed

- Updated compatibility to stable directus 9.0.1
- Remove server as I realised the server would need to track athlete IDs and endpoint urls to be multi user and I don't want to do that. Now you need your own oauth app.
- Add dark mode

### Other

- Converted to typescript

## [1.2.0] - 2021-10-04

### Changed

- Changed app name to Directus Strava
- Make extension path configurable
- Add secret for webhook endpoint
- Add favicon and title to html pages

### Other

-  Improve heroku server documentation

## [1.1.0] - 2021-10-04

### Changed

- Check for Directus login so that unauthenticated users cannot see Strava data
- Use cookies for storing Strava token to eliminate need for metadata table in Directus
  
## [1.0.1] - 2021-10-01

### Fixed

- Fix authentication token not refreshing due to reinitialised variable
- Fix updated checkmark not appearing due to query string / activity id type mismatch

### Other

- Added dev build script that includes sourcemaps

## [1.0.0] - 2021-09-13

### Added

- Initial release.
