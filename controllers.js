angular.module('myApp')

.controller('RootCtrl',
  function(user) {
    user.redirect()
  }
)

.controller('RequireLoginCtrl',
  function($scope, user) {
    $scope.signedIn = function(oauth) {
      user.setCredentials(oauth)
      user.redirect()
    }
  }
)

.controller('UploadFormCtrl',
  function($scope, amazonApi, user, filesCollection, $q, $location, uuid, $window, $state) {
    var filesUploaded = []

    angular.extend($scope, {
      pid: $location.search().pid,

      form: { user: {}, game: {} },

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
                var country = $scope.form.publishedAppRegion || 'US'
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
              file.uuid = uuid()
              file.userId = $scope.form.user.id
              file.key = file.userId + '/' + file.uuid + '-' + file.name

              amazonApi.uploadFile(file).then(
                function success() {
                  file.url = amazonApi.getUrl(file)
                  file.uploading = 'Complete'
                  file.uploaded.resolve()
                },

                function error() {},

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

      removeFile: function(file) {
        filesCollection.remove(file)
      },

      submitForm: function() {
        if ($scope.uploadForm.$valid === true) {
          $scope.submitStatus = 'Waiting for files to be uploaded...'
          $scope.submitButtonDisabled = true

          $q.all(filesUploaded).then(function() {
            var formDataJson = {}
            var exportedData = {}

            exportedData.pid = $scope.pid
            exportedData.form = angular.copy($scope.form)
            exportedData.itunesSearchResults = angular.copy($scope.form.itunesApp)
            exportedData.timezoneOffset = new Date().getTimezoneOffset() / 60
            exportedData.files = _.map(filesCollection.get(), function(file) {
              return { name: file.name, url: file.url }
            })

            _.each(exportedData.form.game, function(value, key) {
              if (!_.contains([
                'trackName',
                'genreName',
                'sellerUrl',
                'releaseDate',
                'twitterHandle',
                'artistName'
              ], key)) {
                delete exportedData.form.game[key]
              }
            })

            delete exportedData.form.user.accessToken
            delete exportedData.form.user.idToken
            delete exportedData.form.itunesApp

            $scope.submitStatus = 'Submitting...'

            formDataJson.name = 'formData.json'
            formDataJson.uuid = uuid()
            formDataJson.userId = $scope.form.user.id
            formDataJson.key = formDataJson.userId + '/' + formDataJson.uuid + '-' + formDataJson.name
            formDataJson.body = JSON.stringify(exportedData, undefined, 2)
            formDataJson.type = 'application/json'

            amazonApi.uploadFile(formDataJson).then(function() {
              $q.all([
                amazonApi.sendSns({
                  subject: 'Game assets uploaded by ' +
                           exportedData.form.user.name.display +
                           ' from ' +
                           exportedData.form.game.artistName,
                  body: 'Project link:\n https://googleapps.insight.ly/Projects/Details/' + exportedData.pid + '\n\n\n' +
                        formDataJson.name + ':\n' + amazonApi.getUrl(formDataJson) + '\n\n\n' +
                        _.reduce(filesCollection.get(), function(memo, file) {
                          return memo + file.name + ':\n' + file.url + '\n\n\n'
                        }, '')
                }),
                amazonApi.sendSqs(formDataJson.body)
              ]).then(function() {
                $scope.submitStatus = 'Form submitted successfully.'
                $state.go('thankYou')
              })
            })
          })
        } else {
          $scope.submitStatus = 'Required fields are missing.'
        }
      }
    })

    $scope.$watch('form.itunesApp', function(itunesApp) {
      if (angular.isObject(itunesApp)) {
        angular.extend($scope.form.game, itunesApp)
      }
    })

    user.populateInfo().then(function(user) {
      angular.extend($scope.form.user, user)
    })

    $window.onbeforeunload = function() {
      if ($scope.submitStatus === 'Form submitted successfully.' || !$state.is('uploadForm')) { return null }

      if (!$scope.uploadForm.$pristine === true || filesCollection.get().length > 0) {
        return 'Are you sure you want to navigate away from this page?'
      }

      return null
    }
  }
)

.controller('CountrySelectCtrl',
  function($scope) {
    $scope.countrySelectOptions = {
      ae: "United Arab Emirates", ag: "Antigua and Barbuda", ai: "Anguilla", al: "Albania", am: "Armenia", ao: "Angola",
      ar: "Argentina", at: "Austria", au: "Australia", az: "Azerbaijan", bb: "Barbados", be: "Belgium",
      bf: "Burkina Faso", bg: "Bulgaria", bh: "Bahrain", bj: "Benin", bm: "Bermuda", bn: "Brunei Darussalam",
      bo: "Bolivia", br: "Brazil", bs: "Bahamas", bt: "Bhutan", bw: "Botswana", by: "Belarus", bz: "Belize",
      ca: "Canada", cg: "Congo, Republic of the", ch: "Switzerland", cl: "Chile", cn: "China", co: "Colombia",
      cr: "Costa Rica", cv: "Cape Verde", cy: "Cyprus", cz: "Czech Republic", de: "Germany", dk: "Denmark",
      dm: "Dominica", do: "Dominican Republic", dz: "Algeria", ec: "Ecuador", ee: "Estonia", eg: "Egypt",
      es: "Spain", fi: "Finland", fj: "Fiji", fm: "Micronesia, Federated States of", fr: "France", gb: "United Kingdom",
      gd: "Grenada", gh: "Ghana", gm: "Gambia", gr: "Greece", gt: "Guatemala", gw: "Guinea-Bissau", gy: "Guyana",
      hk: "Hong Kong", hn: "Honduras", hr: "Croatia", hu: "Hungary", id: "Indonesia", ie: "Ireland", il: "Israel",
      in: "India", is: "Iceland", it: "Italy", jm: "Jamaica", jo: "Jordan", jp: "Japan", kz: "Kazakhstan",
      ke: "Kenya", kg: "Kyrgyzstan", kh: "Cambodia", kn: "St. Kitts and Nevis", kr: "Korea, Republic Of", kw: "Kuwait",
      ky: "Cayman Islands", la: "Lao, People's Democratic Republic", lb: "Lebanon", lc: "St. Lucia",
      lk: "Sri Lanka", lr: "Liberia", lt: "Lithuania", lu: "Luxembourg", lv: "Latvia", md: "Moldova", mg: "Madagascar",
      mk: "Macedonia", ml: "Mali", mn: "Mongolia", mo: "Macau", mr: "Mauritania", ms: "Montserrat", mt: "Malta",
      mu: "Mauritius", mw: "Malawi", mx: "Mexico", my: "Malaysia", mz: "Mozambique", na: "Namibia", ne: "Niger",
      ng: "Nigeria", ni: "Nicaragua", nl: "Netherlands", no: "Norway", np: "Nepal", nz: "New Zealand", om: "Oman",
      pa: "Panama", pe: "Peru", pg: "Papua New Guinea", ph: "Philippines", pk: "Pakistan", pl: "Poland", pt: "Portugal",
      pw: "Palau", py: "Paraguay", qa: "Qatar", ro: "Romania", ru: "Russia", sa: "Saudi Arabia", sb: "Solomon Islands",
      sc: "Seychelles", se: "Sweden", sg: "Singapore", si: "Slovenia", sk: "Slovakia", sl: "Sierra Leone",
      sn: "Senegal", sr: "Suriname", st: "São Tomé and Príncipe", sv: "El Salvador", sz: "Swaziland",
      tc: "Turks and Caicos", td: "Chad", th: "Thailand", tj: "Tajikistan", tm: "Turkmenistan", tn: "Tunisia",
      tr: "Turkey", tt: "Trinidad and Tobago", tw: "Taiwan", tz: "Tanzania", ua: "Ukraine", ug: "Uganda",
      us: "United States", uy: "Uruguay", uz: "Uzbekistan", vc: "St. Vincent and The Grenadines", ve: "Venezuela",
      vg: "British Virgin Islands", vn: "Vietnam", ye: "Yemen", za: "South Africa", zw: "Zimbabwe"
    }

    $scope.form.publishedAppRegion = 'us'
  }
)