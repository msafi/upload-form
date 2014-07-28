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
  function($scope, amazonApi, user) {
    // @todo: get timezone offset
    // @todo: get artistId
    // @todo: get appId

    angular.extend($scope, {
      user: {},

      twitterTypeaheadOptions: { highlight: true },

      twitterTypeaheadData: [],

      initializeAppSuggestions: function() {
        var urlBase = 'https://itunes.apple.com/search?media=software&limit=5'
        var iphoneAppSuggestions = {}
        var ipadAppSuggestions = {}
        var generateBloodhoundOptions = function(device) {
          var deviceDictionary = {
            iphone: 'software',
            ipad: 'iPadSoftware'
          }

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

        this.twitterTypeaheadData.push(
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
        var file = files[0]
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

        amazonApi.uploadFile({
          Key: $scope.user.id + '/' + file.name,
          Body: file,
          ContentType: file.type
        }).then(
          function success() {
            delete $scope.uploading

            listObjects()
          },

          function error() {},

          function notification(uploadProgress) {
            var percentage = parseInt(uploadProgress.loaded / uploadProgress.total * 100)
            percentage += '%'

            $scope.uploading = { percentage: percentage }
          }
        )

        fileReader.readAsDataURL(files[0])
      }
    })

    user.populateInfo().then(function(user) {
      $scope.user = user

      listObjects()
    })

    function listObjects() {
      amazonApi.listObjects({ Prefix: $scope.user.id }).then(function(response) {
        $scope.user.files = []

        if (!response.data) { return }

        _.each(response.data.Contents, function(file) {
          $scope.user.files.push(file.Key.replace($scope.user.id + '/', ''))
        })
      })
    }
  }
)