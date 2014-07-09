angular.module('myApp', ['angularFileUpload'])

.controller('MyCtrl',
  function($scope, $upload) {
    $scope.onFileSelect = function(files) {
      var fileReader = new FileReader

      fileReader.onload = function() {
        var img = new Image

        img.onload = function() {
          $scope.$apply(function() {
            $scope.uploadedImg = {
              width: img.width + 'px',
              height: img.height + 'px',
              src: img.src
            }
          })
        }

        img.src = fileReader.result
      }

      fileReader.readAsDataURL(files[0])
    }
  }
)