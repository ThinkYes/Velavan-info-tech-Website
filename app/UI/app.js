'use strict';

// Declare app level module which depends on views, and components
var velavan = {};
velavan.website = {};
velavan.website.App = {};
velavan.website.App  = angular.module('velavan', [
  'ngRoute',
  'ui.bootstrap',
  'uiGmapgoogle-maps',
  'velavan.version'
]);

velavan.website.App.config(['$locationProvider', '$routeProvider', function($locationProvider, $routeProvider) {
  $locationProvider.hashPrefix('!');
  $routeProvider.
  when('/view1', {
    templateUrl: 'app/partials/view1.html',
    controller: 'View1Ctrl'
  }).
  when('/view2', {
    templateUrl: 'app/partials/view2.html',
    controller: 'View1Ctrl'
  }).
  when('/ContactUs', {
    templateUrl: 'app/partials/contactUS/contactUsHome.html',
    controller: 'contactUsController'
  }).
  otherwise({
    redirectTo: '/view1'
  });
}]);
