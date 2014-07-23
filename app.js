// Manual bootstrapping to prevent race condition with Google Plus SDK
window.onLoadCallback = function() {
  // When the document is ready
  angular.element(document).ready(function() {
    // Bootstrap the oauth2 library
    gapi.client.load('oauth2', 'v2', function() {
      // Finally, bootstrap our angular app
      angular.bootstrap(document, ['myApp']);
    });
  });
}

angular.module('myApp', [
  'angularFileUpload',
  'ui.router',
  'siyfion.sfTypeahead',
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