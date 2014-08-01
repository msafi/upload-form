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
  function($scope, amazonApi, user, filesCollection, $q, $location) {
    var filesUploaded = []

    angular.extend($scope, {
      pid: $location.search().pid,

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
            exportedUser.pid = $scope.pid

            amazonApi.uploadFile({
              Key: $scope.user.id + '/userData.json',
              Body: JSON.stringify(exportedUser, undefined, 2),
              ContentType: 'application/json'
            }).then(function() {
              $q.all([
                amazonApi.sendSns({
                  subject: 'Game assets uploaded by ' +
                    exportedUser.name.display +
                    ' from ' +
                    exportedUser.publishedApp.artistName,
                  body: 'userData.json: ' + amazonApi.getSignedUrl($scope.user.id + '/userData.json') + '\n\n\n' +
                    _.reduce(filesCollection.get(), function(memo, file) {
                      return memo + file.name + ':\n' + file.signedUrl + '\n\n\n'
                    }, '')
                }),
                amazonApi.sendSqs(JSON.stringify({ newFilesLocation: $scope.user.id }, undefined, 2))
              ]).then(function() {
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

.controller('CountrySelectCtrl',
  function($scope) {
    $scope.countrySelectOptions = {
      ae: "United Arab Emirates",
      ag: "Antigua and Barbuda",
      ai: "Anguilla",
      al: "Albania",
      am: "Armenia",
      ao: "Angola",
      ar: "Argentina",
      at: "Austria",
      au: "Australia",
      az: "Azerbaijan",
      bb: "Barbados",
      be: "Belgium",
      bf: "Burkina Faso",
      bg: "Bulgaria",
      bh: "Bahrain",
      bj: "Benin",
      bm: "Bermuda",
      bn: "Brunei Darussalam",
      bo: "Bolivia",
      br: "Brazil",
      bs: "Bahamas",
      bt: "Bhutan",
      bw: "Botswana",
      by: "Belarus",
      bz: "Belize",
      ca: "Canada",
      cg: "Congo, Republic of the",
      ch: "Switzerland",
      cl: "Chile",
      cn: "China",
      co: "Colombia",
      cr: "Costa Rica",
      cv: "Cape Verde",
      cy: "Cyprus",
      cz: "Czech Republic",
      de: "Germany",
      dk: "Denmark",
      dm: "Dominica",
      do: "Dominican Republic",
      dz: "Algeria",
      ec: "Ecuador",
      ee: "Estonia",
      eg: "Egypt",
      es: "Spain",
      fi: "Finland",
      fj: "Fiji",
      fm: "Micronesia, Federated States of",
      fr: "France",
      gb: "United Kingdom",
      gd: "Grenada",
      gh: "Ghana",
      gm: "Gambia",
      gr: "Greece",
      gt: "Guatemala",
      gw: "Guinea-Bissau",
      gy: "Guyana",
      hk: "Hong Kong",
      hn: "Honduras",
      hr: "Croatia",
      hu: "Hungary",
      id: "Indonesia",
      ie: "Ireland",
      il: "Israel",
      in: "India",
      is: "Iceland",
      it: "Italy",
      jm: "Jamaica",
      jo: "Jordan",
      jp: "Japan",
      kz: "Kazakhstan",
      ke: "Kenya",
      kg: "Kyrgyzstan",
      kh: "Cambodia",
      kn: "St. Kitts and Nevis",
      kr: "Korea, Republic Of",
      kw: "Kuwait",
      ky: "Cayman Islands",
      la: "Lao, People's Democratic Republic",
      lb: "Lebanon",
      lc: "St. Lucia",
      lk: "Sri Lanka",
      lr: "Liberia",
      lt: "Lithuania",
      lu: "Luxembourg",
      lv: "Latvia",
      md: "Moldova",
      mg: "Madagascar",
      mk: "Macedonia",
      ml: "Mali",
      mn: "Mongolia",
      mo: "Macau",
      mr: "Mauritania",
      ms: "Montserrat",
      mt: "Malta",
      mu: "Mauritius",
      mw: "Malawi",
      mx: "Mexico",
      my: "Malaysia",
      mz: "Mozambique",
      na: "Namibia",
      ne: "Niger",
      ng: "Nigeria",
      ni: "Nicaragua",
      nl: "Netherlands",
      no: "Norway",
      np: "Nepal",
      nz: "New Zealand",
      om: "Oman",
      pa: "Panama",
      pe: "Peru",
      pg: "Papua New Guinea",
      ph: "Philippines",
      pk: "Pakistan",
      pl: "Poland",
      pt: "Portugal",
      pw: "Palau",
      py: "Paraguay",
      qa: "Qatar",
      ro: "Romania",
      ru: "Russia",
      sa: "Saudi Arabia",
      sb: "Solomon Islands",
      sc: "Seychelles",
      se: "Sweden",
      sg: "Singapore",
      si: "Slovenia",
      sk: "Slovakia",
      sl: "Sierra Leone",
      sn: "Senegal",
      sr: "Suriname",
      st: "São Tomé and Príncipe",
      sv: "El Salvador",
      sz: "Swaziland",
      tc: "Turks and Caicos",
      td: "Chad",
      th: "Thailand",
      tj: "Tajikistan",
      tm: "Turkmenistan",
      tn: "Tunisia",
      tr: "Turkey",
      tt: "Trinidad and Tobago",
      tw: "Taiwan",
      tz: "Tanzania",
      ua: "Ukraine",
      ug: "Uganda",
      us: "United States",
      uy: "Uruguay",
      uz: "Uzbekistan",
      vc: "St. Vincent and The Grenadines",
      ve: "Venezuela",
      vg: "British Virgin Islands",
      vn: "Vietnam",
      ye: "Yemen",
      za: "South Africa",
      zw: "Zimbabwe"
    }

    $scope.user.publishedAppRegion = $scope.countrySelectOptions['us']
  }
)