angular.module('myApp', [
  'angularFileUpload',
  'ui.router',
  'ngCookies'
])

.config(
  function($stateProvider, $locationProvider) {
    $stateProvider
      .state('uploadForm', {
        controller: 'UploadFormCtrl',
        templateUrl: 'upload-form.html',
      })
      .state('requireLogin', {
        controller: 'RequireLoginCtrl',
        templateUrl: 'require-login.html'
      })

    $locationProvider
      .html5Mode(true)
  }
)