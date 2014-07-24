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
    var url = 'https://itunes.apple.com/search?media=software&limit=10&term=%QUERY';
    var appSuggestions = new Bloodhound({
      datumTokenizer: function(d) { return Bloodhound.tokenizers.whitespace(d.trackName) },
      queryTokenizer: Bloodhound.tokenizers.whitespace,
      remote: { url: url, ajax: { type: 'GET', dataType: 'jsonp' }, filter: function(data) { return data.results } },
    })

    appSuggestions.initialize()

    angular.extend($scope, {
      user: {},

      twitterTypeaheadOptions: { highlight: true },

      twitterTypeaheadData: { displayKey: 'trackName', source: appSuggestions.ttAdapter() },

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