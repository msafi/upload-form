angular.module('myApp')

.service('amazonApi',
  function($q, user) {
    var amazonAuthenticated = false
    var bucketName = 'upload-form'
    var roleArn = 'arn:aws:iam::901881000271:role/uploader'
    var topicArn = 'arn:aws:sns:eu-west-1:901881000271:upload-form'
    var s3
    var sns

    return {
      authenticate: function() {
        var credentials = $q.defer()

        if (user.isAuthenticated()) {
          if (!amazonAuthenticated) {
            AWS.config.credentials = new AWS.WebIdentityCredentials({
              RoleArn: roleArn,
              WebIdentityToken: user.get().idToken
            })

            s3 = new AWS.S3({ params: { Bucket: bucketName } })
            sns = new AWS.SNS({ region: 'eu-west-1' })
            amazonAuthenticated = true
          }

          credentials.resolve(AWS.config.credentials)
        } else {
          credentials.reject({ errorMessage: 'User not authenticated.' })
          amazonAuthenticated = false

          user.redirect()
        }

        return credentials.promise
      },

      listObjects: function(options) {
        var files = $q.defer()

        this.authenticate().then(function() {
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

        this.authenticate().then(function() {
          options = options || {}
          options.Bucket = bucketName

          s3.putObject(options)
            .on('httpUploadProgress', function(uploadProgress) {
              fileUploadResponse.notify({
                loaded: uploadProgress.loaded,
                total: uploadProgress.total
              })
            })
            .on('complete', function() {
              fileUploadResponse.resolve(true)
            })
            .send()
        })

        return fileUploadResponse.promise
      },

      sendNotification: function() {
        var messageStatus = $q.defer()

        this.authenticate().then(function() {
          sns.publish({
            TopicArn: topicArn,
            Message: 'Hi Andy,\n\nThis is the message.\n\nThis is a new line in the same message.\n\nKtnxbai,\n\n-MK',
            Subject: 'New files uploaded from a game developer'
          }, function(error, data) {
            if (error !== null) {
              messageStatus.reject()
            } else {
              messageStatus.resolve()
            }
          })
        })

        return messageStatus.promise
      }
    }
  }
)

.service('user',
  function($state, $q) {
    var user = {}
    var credentials = {}

    return {
      redirect: function() {
        $state.go('uploadForm')
        return

        if (this.isAuthenticated()) {
          $state.go('uploadForm')
        } else {
          $state.go('requireLogin')
        }
      },

      isAuthenticated: function() {
        var currentTime = parseInt(new Date().valueOf() / 1000)

        return credentials && credentials.expires_at > currentTime
      },

      setCredentials: function(newCredentials) {
        angular.extend(user, {
          accessToken: newCredentials.access_token,
          idToken: newCredentials.id_token
        })

        credentials = newCredentials
      },

      get: function() {
        return user
      },

      populateInfo: function() {
        var userInfo = $q.defer()

        gapi.client.oauth2.userinfo.get().execute(function(freshUserInfo) {
          angular.extend(user, {
            name: {
              display: freshUserInfo.name,
              familyName: freshUserInfo.family_name,
              givenName: freshUserInfo.given_name
            },
            domain: freshUserInfo.hd,
            email: freshUserInfo.email,
            gender: freshUserInfo.gender,
            id: freshUserInfo.id,
            image: freshUserInfo.picture,
            googlePlusUrl: freshUserInfo.link
          })

          userInfo.resolve(user)
        })

        return userInfo.promise
      }
    }
  }
)

.service('filesValidator',
  function($q) {
    var files = []

    return {
      files: files,

      requiredTypes: {
        video: false,
        halfSheet: false,
        oneSheet: false,
        descriptionDocument: false
      },

      add: function(newFiles) {
        var self = this

        _.each(newFiles, function(newFile) {
          validateDescriptionDocument(newFile).then(function() {
            self.requiredTypes.descriptionDocument = true
            files.push({ file: newFile, type: 'descriptionDocument' })
          }, function() {
            validateVideo(newFile).then(function() {
              self.requiredTypes.video = true
              files.push({ file: newFile, type: 'video' })
            }, function() {
              validateImageFile(newFile, [3840, 2160]).then(function() { // Halfsheet specs
                self.requiredTypes.halfSheet = true
                files.push({ file: newFile, type: 'halfSheet' })
              }, function() {
                validateImageFile(newFile, [3072, 4608]).then(function() { // Onesheet specs
                  self.requiredTypes.oneSheet = true
                  files.push({ file: newFile, type: 'oneSheet' })
                }, function() {
                  files.push({ file: newFile, type: 'other' }) // Other
                })
              })
            })
          })
        })
      },
    }

    function validateDescriptionDocument(file) {
      var validateDescriptionDocument = $q.defer()

      if (_.any([
        'application/pdf',
        'text/plain',
        'text/rtf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/x-iwork-pages-sffpages'
      ], function(mimeType) {
        return file.type === mimeType
      })) {
        validateDescriptionDocument.resolve()
      } else {
        validateDescriptionDocument.reject()
      }

      return validateDescriptionDocument.promise
    }

    function validateVideo(file) {
      var validateVideo = $q.defer()

      if (_.any([
        'video/avi',
        'video/mpeg',
        'video/mp4',
        'video/ogg',
        'video/quicktime',
        'video/webm'
      ], function(mimeType) {
        return file.type === mimeType
      })) {
        validateVideo.resolve()
      } else {
        validateVideo.reject()
      }

      return validateVideo.promise
    }

    function validateImageFile(file, dimensions) {
      var validateImageFile = $q.defer()
      var fileReader = new FileReader

      if (_.any([
        'image/gif',
        'image/jpeg',
        'image/pjpeg',
        'image/png',
      ], function(mimeType) {
        return file.type === mimeType
      })) {
        fileReader.onload = function() {
          var img = new Image

          img.onload = function() {
            if (img.width === dimensions[0] && img.height === dimensions[1]) {
              validateImageFile.resolve()
            } else {
              validateImageFile.reject()
            }
          }

          img.src = fileReader.result
        }

        fileReader.readAsDataURL(file)
      } else {
        validateImageFile.reject()
      }

      return validateImageFile.promise
    }
  }
)