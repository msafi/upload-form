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