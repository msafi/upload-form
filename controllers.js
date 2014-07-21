angular.module('myApp')

.controller('RootCtrl',
  function($state, googleApi) {
    googleApi.authenticate({
      success: function() {
        $state.go('uploadForm')
      },
      failure: function() {
        $state.go('requireLogin')
      }
    })
  }
)

.controller('RequireLoginCtrl',
  function($scope, $location) {
  }
)

.controller('UploadFormCtrl',
  function($scope, amazonApi, googleApi) {
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

    googleApi.getUserInfo().then(function(user) {
      $scope.user = user

      amazonApi.authenticate(user.idToken)
      listObjects()
    })

    function listObjects() {
      $scope.user.files = []
      
      amazonApi.listObjects({ Prefix: $scope.user.id }).then(function(response) {
        _.each(response.data.Contents, function(file) {
          $scope.user.files.push(file.Key.replace($scope.user.id + '/', ''))
        })
      })
    }
  }
)