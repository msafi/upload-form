angular.module('myApp', [
  'angularFileUpload',
  'ui.router',
  'ngCookies'
])

.config(
  function($stateProvider, $locationProvider) {
    $stateProvider
      .state('root', {
        url: '/upload-form/angular.html',
        controller: 'RootCtrl',
      })
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

.controller('RootCtrl',
  function($cookies, $state, $location, parseQueryString, $http) {
    var params = parseQueryString($location.hash())

    if (params.id_token) {
      $location.hash('')

      // Authenticate with Amazon
      $http({
        method: 'GET',
        params: {
          DurationSeconds: '900',
          Version: '2011-06-15',
          Action: 'AssumeRoleWithWebIdentity',
          RoleSessionName: 'web-identity-federation',
          RoleArn: 'arn:aws:iam::901881000271:role/upload-form',
          WebIdentityToken: params.id_token
        },
        url: 'https://sts.amazonaws.com/'
      }).then(function(response) {
        localStorage['credentials'] = JSON.stringify(
          response
            .data
            .AssumeRoleWithWebIdentityResponse
            .AssumeRoleWithWebIdentityResult
            .Credentials
        )
      })
    }

    if ($cookies.asdf) {
      $state.go('uploadForm')
    } else {
      $state.go('requireLogin')
    }
  }
)

.controller('RequireLoginCtrl',
  function($scope, $location) {
    angular.extend($scope, {
      getAuthenticationUrl: function() {
        var redirecUri = ($location.host() === 'localhost')
          ? 'http://localhost:63342/upload-form/angular.html'
          : 'http://msafi.github.io/upload-form/angular.html'

        var queryString = $.param({
          response_type: 'id_token',
          client_id: '404616317148-4j6lk78a2ltlkqbsv63o7v4ia5ntqgbg.apps.googleusercontent.com',
          redirect_uri: redirecUri,
          scope: 'openid email profile'
        })

        return 'https://accounts.google.com/o/oauth2/auth?' + queryString
      }
    })
  }
)

.controller('UploadFormCtrl',
  function($scope, $upload, $http) {
    angular.extend($scope, {
      onFileSelect: function(files) {
        var fileReader = new FileReader

        fileReader.onload = function() {
          var img = new Image

          img.onload = function() {
            $scope.$apply(function() {
              $scope.uploadedImg = {
                width: img.width + 'px',
                height: img.height + 'px',
                size: files[0].size + 'bytes',
                src: img.src
              }
            })
          }

          img.src = fileReader.result
        }

        fileReader.readAsDataURL(files[0])
      }
    })
  }
)

.service('parseQueryString',
  function() {
    return function(queryString) {
      var params = {}
      var regex = /([^&=]+)=([^&]*)/g
      var m

      while (m = regex.exec(queryString)) {
        params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
      }

      return params
    }
  }
)