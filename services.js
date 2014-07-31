angular.module('myApp')

.service('amazonApi',
  function($q, user) {
    var amazonAuthenticated = false
    var bucketName = 'upload-form'
    var roleArn = 'arn:aws:iam::901881000271:role/uploader'
    var topicArn = 'arn:aws:sns:eu-west-1:901881000271:upload-form'
    var snsRegion = 'eu-west-1'
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
            sns = new AWS.SNS({ region: snsRegion })
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
            .on('error', function() {
              fileUploadResponse.resolve(false)
              console.log(arguments)
            })
            .send()
        })

        return fileUploadResponse.promise
      },

      getSignedUrl: function(key) {
        return s3.getSignedUrl('getObject', {
          Bucket: bucketName,
          Key: key,
          Expires: 78892300 // 25 years in seconds
        })
      },

      sendNotification: function(message) {
        var messageStatus = $q.defer()

        this.authenticate().then(function() {
          sns.publish({
            TopicArn: topicArn,
            Subject: message.subject,
            Message: message.body,
          }, function(error, data) {
            if (error !== null) {
              messageStatus.resolve(false)
            } else {
              messageStatus.resolve(true)
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
    var credentials

    return {
      redirect: function() {
        if (this.isAuthenticated()) {
          $state.go('uploadForm')
        } else {
          $state.go('requireLogin')
        }
      },

      isAuthenticated: function() {
        var currentTime = parseInt(new Date().valueOf() / 1000)
        credentials = credentials || (localStorage['credentials'] && JSON.parse(localStorage['credentials']))

        if (credentials && credentials.expires_at > currentTime) {
          this.setCredentials(credentials)
          return true
        } else {
          return false
        }
      },

      setCredentials: function(newCredentials) {
        angular.extend(user, {
          accessToken: newCredentials.access_token,
          idToken: newCredentials.id_token
        })

        credentials = newCredentials
        gapi.auth.setToken(credentials)
        localStorage['credentials'] = JSON.stringify(credentials)
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

.service('filesCollection',
  function($q) {
    var files = []
    var supportedTypes = {
      descriptionDocument: ['pdf', 'txt', 'doc', 'docx'],
      image: ['gif', 'jpeg', 'png'],
      video: ['avi', 'mpeg', 'mov', 'mp4', 'ogg', 'm4v', 'webm'],
    }

    return {
      get: function() {
        return files
      },

      add: function(newFiles) {
        var add = $q.defer()

        _.each(newFiles, function(newFile, index) {
          $q.all({
            descriptionDocument: validateExtension(supportedTypes.descriptionDocument, newFile),
            video: validateExtension(supportedTypes.video, newFile),
            hsAndBs: validateImageFile(newFile, [3840, 2160]),
            oneSheet: validateImageFile(newFile, [3072, 4608])
          }).then(function(results) {
            files.push(initFile(newFile, {
              assetType: _.invert(results)['true'] || 'other'
            }))

            if (index === newFiles.length - 1) {
              add.resolve(files)
            }
          })
        })

        return add.promise

        function initFile(newFile, newProperties) {
          return angular.extend(newFile, newProperties)
        }

        function validateExtension(extensions, file) {
          var validateExtensions = $q.defer()

          if (_.any(extensions, function(extension) {
            return file.name.substr(-extension.length) === extension
          })) {
            validateExtensions.resolve(true)
          } else {
            validateExtensions.resolve(false)
          }

          return validateExtensions.promise
        }

        function validateImageFile(file, dimensions) {
          var validateImageFile = $q.defer()
          var fileReader = new FileReader

          if (_.any(supportedTypes.image, function(extension) {
            return file.name.substr(-extension.length) === extension
          })) {
            fileReader.onload = function() {
              var img = new Image

              img.onload = function() {
                if (img.width === dimensions[0] && img.height === dimensions[1]) {
                  validateImageFile.resolve(true)
                } else {
                  validateImageFile.resolve(false)
                }
              }

              img.src = fileReader.result
            }

            fileReader.readAsDataURL(file)
          } else {
            validateImageFile.resolve(false)
          }

          return validateImageFile.promise
        }
      },
    }
  }
)