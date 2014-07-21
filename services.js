angular.module('myApp')

.service('googleApi',
  function($http, $q, $cookies) {
    var user = {}
    var googleResponse = $q.defer()

    return {
      authenticate: function(callbacks) {
        if (!this.userIsAuthenticated()) {
          callbacks.failure()
        } else {
          callbacks.success()
        }

        window.googleSignInCb = function(serverResponse) {
          user.idToken = serverResponse.id_token
          user.accessToken = serverResponse.access_token
          setUser()
          googleResponse.resolve(true)
          callbacks.success()
        }
      },

      userIsAuthenticated: function() {
        var user = getUser()

        return user && !!user.email
      },

      authenticated: googleResponse.promise,

      getUserInfo: function() {
        var deferredUser = $q.defer()

        if (this.userIsAuthenticated()) {
          deferredUser.resolve(getUser())
        } else {
          this.authenticated.then(function() {
            $http({
              method: 'GET',
              params: {
                access_token: user.accessToken
              },
              url: 'https://www.googleapis.com/plus/v1/people/me'
            }).success(function(response) {
              angular.extend(user, {
                name: {
                  display: response.displayName,
                  familyName: response.name.familyName,
                  givenName: response.name.givenName
                },
                domain: response.domain,
                email: response.emails[0].value,
                gender: response.gender,
                id: response.id,
                image: response.image.url,
                googlePlusUrl: response.url
              })

              setUser()
              deferredUser.resolve(user)
            })
          })
        }

        return deferredUser.promise
      },
    }

    function setUser() {
      localStorage['user'] = JSON.stringify(user)
    }

    function getUser() {
      return localStorage['user'] && JSON.parse(localStorage['user'])
    }
  }
)

.service('amazonApi',
  function($q, $timeout) {
    var bucketName = 'upload-form'
    var credentials = $q.defer()
    var s3

    return {
      authenticatedUser: credentials.promise,

      authenticate: function(idToken) {
        AWS.config.credentials = new AWS.WebIdentityCredentials({
          RoleArn: 'arn:aws:iam::901881000271:role/uploader',
          WebIdentityToken: idToken
        })

        credentials.resolve(AWS.config.credentials)
        s3 = new AWS.S3({
          params: { Bucket: bucketName }
        })
      },

      listObjects: function(options) {
        var files = $q.defer()

        this.authenticatedUser.then(function() {

          s3.listObjects(options, function(error, data) {
            files.resolve({
              error: error,
              data: data
            })
          })
        })

        return files.promise
      },

      uploadFile: function(options) {
        var fileUploadResponse = $q.defer()

        this.authenticatedUser.then(function() {
          options = options || {}
          options.Bucket = bucketName

          s3.putObject(options, function(error, data) {
            fileUploadResponse.resolve({ error: error, data: data })
          })
        })

        return fileUploadResponse.promise
      }
    }
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