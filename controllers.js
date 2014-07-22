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
    angular.extend($scope, {
      user: {},

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
        }).then(function() {
          listObjects()
        })

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

        _.each(response.data.Contents, function(file) {
          $scope.user.files.push(file.Key.replace($scope.user.id + '/', ''))
        })
      })
    }
  }
)