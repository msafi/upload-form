angular.module('myApp')

.controller('RootCtrl',
  function(user) {
    user.redirect()
  }
)

.controller('RequireLoginCtrl',
  function($scope, user, $state) {
    $scope.signedIn = function(oauth) {
      user.setCredentials(oauth)
      user.redirect()
    }
  }
)

.controller('UploadFormCtrl',
  function($scope, amazonApi, user, filesCollection, $q) {
    var filesUploaded = []

    angular.extend($scope, {
      user: {},

      twitterTypeaheadOptions: { highlight: true },

      twitterTypeaheadData: [],

      findType: function(fileType) {
        return _.where(filesCollection.get(), { assetType: fileType })
      },

      initializeAppSuggestions: function() {
        var urlBase = 'https://itunes.apple.com/search?media=software&limit=5'
        var iphoneAppSuggestions = {}
        var ipadAppSuggestions = {}
        var generateBloodhoundOptions = function(device) {
          var deviceDictionary = { iphone: 'software', ipad: 'iPadSoftware' }

          return {
            datumTokenizer: function(d) { return Bloodhound.tokenizers.whitespace(d.trackName) },
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            remote: {
              url: urlBase,
              replace: function(url, query) {
                var country = ($scope.user && $scope.user.publishedAppRegion) || 'US'
                var term = query
                var url = [
                  urlBase,
                  'entity=' + deviceDictionary[device],
                  'country=' + country,
                  'term=' + encodeURIComponent(term)
                ].join('&')

                return url
              },
              ajax: {
                type: 'GET',
                dataType: 'jsonp',
                beforeSend: function(xhr) { $scope.$apply(function() { $scope.contactingItunes = true }); return xhr },
                complete: function() { $scope.$apply(function() { $scope.contactingItunes = false }) },
              },
              filter: function(data) { return data.results },
              rateLimitWait: 30,
            },
          }
        }

        iphoneAppSuggestions = new Bloodhound(generateBloodhoundOptions('iphone'))
        iphoneAppSuggestions.initialize()

        ipadAppSuggestions = new Bloodhound(generateBloodhoundOptions('ipad'))
        ipadAppSuggestions.initialize()

        $scope.twitterTypeaheadData = []
        $scope.twitterTypeaheadData.push(
          { name: 'iphone', displayKey: 'trackName', source: iphoneAppSuggestions.ttAdapter() },
          { name: 'ipad', displayKey: 'trackName', source: ipadAppSuggestions.ttAdapter() }
        )
      },

      sendNotification: function() {
        amazonApi.sendNotification()
      },

      publishedAppIsFound: function(publishedApp) {
        return angular.isObject(publishedApp)
      },

      onFileSelect: function(files) {
        filesCollection.add(files).then(function(files) {
          _.each(files, function(file) {
            if (file.uploading === undefined) {
              file.uploaded = $q.defer()
              filesUploaded.push(file.uploaded.promise)

              file.uploading = 'Starting upload...'
              file.s3Key = $scope.user.id + '/' + file.name

              amazonApi.uploadFile({
                Key: file.s3Key,
                Body: file,
                ContentType: file.type
              }).then(
                function success() {
                  file.signedUrl = amazonApi.getSignedUrl(file.s3Key)
                  file.uploading = 'Complete'
                  file.uploaded.resolve()
                },

                function error() {
                },

                function notification(uploadProgress) {
                  var percentage = parseInt(uploadProgress.loaded / uploadProgress.total * 99)
                  percentage += '%'

                  file.uploading = percentage
                }
              )
            }
          })
        })
      },

      submitForm: function() {
        if ($scope.uploadForm.$valid === true) {
          $scope.submitStatus = 'Waiting for files to be uploaded...'
          $scope.submitButtonDisabled = true

          $q.all(filesUploaded).then(function() {
            var exportedUser = angular.copy($scope.user)

            $scope.submitStatus = 'Submitting...'

            delete exportedUser.accessToken
            delete exportedUser.id

            exportedUser.timezoneOffset = new Date().getTimezoneOffset() / 60

            amazonApi.uploadFile({
              Key: $scope.user.id + '/userData.json',
              Body: JSON.stringify(exportedUser, undefined, 2),
              ContentType: 'application/json'
            }).then(function() {
              amazonApi.sendNotification({
                subject: 'Game assets uploaded by ' +
                         exportedUser.name.display +
                         ' from ' +
                         exportedUser.publishedApp.artistName,
                body: 'userData.json: ' + amazonApi.getSignedUrl($scope.user.id + '/userData.json') + '\n\n\n' +
                      _.reduce(filesCollection.get(), function(memo, file) {
                        return memo + file.name + ':\n' + file.signedUrl + '\n\n\n'
                      }, '')
              }).then(function() {
                $scope.submitStatus = 'Form submitted successfully.'
              })
            })
          })
        } else {
          $scope.submitStatus = 'Required fields are missing.'
        }
      }
    })

    user.populateInfo().then(function(user) {
      $scope.user = user
    })
  }
)