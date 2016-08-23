'use strict';

angular.module('velavan.version', [
  'velavan.version.interpolate-filter',
  'velavan.version.version-directive'
])

.value('version', '0.1');
