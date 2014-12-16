var app = angular.module('list',['angulartics', 'angulartics.google.analytics','ui.bootstrap','dialogs','ngRoute']);

app.config(['$routeProvider', function($routeProvider) {
    $routeProvider.
	when('/',{
	    templateUrl: 'partial/list.html',
	    controller: 'listController'
	}).
	when('/title/:title', {
	    templateUrl: 'partial/single.html',
	    controller: 'singleController'
	}).
	otherwise({
	    redirectTo: '/'
	});
}]);

app.service('getListService', function($http, $q) {    
    this.getList = function() {
        var defer = $q.defer();

        $http.get('./metadata.json')
            .success(function(data) {
                defer.resolve(data);
            })
            .error(function() {
                defer.reject('could not find metadata.json');
            });
	
	return defer.promise;
    };
});

app.service('getDataService', ['$q', function($q, $scope){
    var progress;

    this.getProgress = function(){
	return progress;
    }
    /**
    * @param groupName the name of group to be retrieved.
    * @return AsyncValue<object> {groupName:" " ,data:[] }
    *                               data is an array contains raw data in json format
    */
    this.getData = function(groupName){
	var rootRef = new Firebase("http://cityknowledge.firebaseio.com");
        var dataRef = rootRef.child("data");
        var deferred = $q.defer();
	progress = 0;
        /**
         * @param groupName the name of group to be retrieved.
         * @return AsyncValue<idArray> an array contains ids which are keys to retrieve from rootRef.child("data")
        */                                                                                                                                                               
        function getDataId(groupName){
            var groupRef = rootRef.child("groups").child(groupName).child("members");
            var deferred = $q.defer();
            
            groupRef.once('value', function(dataSnapshot){
                var idArray = [];
                dataSnapshot.forEach(function(childSnapshot){
                    idArray.push(childSnapshot.val());
                });
                deferred.resolve(idArray);
            });
            return deferred.promise;
        }
        function getDataById(idArray){
            var dataArray = [];
            for(var index in idArray){
                dataRef.child(idArray[index]).once('value', function(dataSnapshot){
                    dataArray.push(dataSnapshot.val());
                    progress = 95.0 * dataArray.length / idArray.length
                    if(dataArray.length == idArray.length){
                        deferred.resolve(dataArray);
                    }
                });
            }
	}	
        getDataId(groupName).then(getDataById);
        return deferred.promise;
    }
}]);

app.service('csvService', function(){
    var progress;
    this.getProgress = function(){
	return progress;
    }
    this.convertToCSV = function(title, data, ignore){
	progress = 95;
        function JSONtoCSVHeading(keys){
            var line = "";
            for(i in keys){
                if(line != "") line += ',';
                line += keys[i];
            }
            return line;
        }
	
        function JSONtoCSV(json, keys, i) {
            var line = '';	    
            for (var i in keys) {
                if(line != '') line += ',';
                if (typeof json[keys[i]] === 'undefined') {
                    //if the tuple doesn't have this property, then skip this.
                    continue;
                }
                var jsonEntry = "" + json[keys[i]];
                jsonEntry = jsonEntry.replace(/"/g, '""');
		
                if (jsonEntry.indexOf(',') != -1) {
                    // if the string has commas in it, surround it in quotes 
                    line += '"' + jsonEntry + '"';
                }else {
                    line += jsonEntry;
                }
            }
            return line;
        }
        var members = data;
        var csv = ""
        var keys = []; //the column titles

        for(i in members){
            for(key in members[i].data){
                if($.inArray(key, keys) == -1){
                    keys.push(key);
                }
            }
        }

	//remove ignored column from the keys
	for(i in ignore){
	    var index = $.inArray(ignore[i],keys);
	    if(index != -1){
		keys.splice(index, 1);
	    }
	}

        csv += JSONtoCSVHeading(keys) + "\n";
        for(i in members){
            progress = 95 + 10.0 * i / members.length;
            csv += JSONtoCSV(members[i].data, keys, i) + "\n";
        }
	console.log(title);
        //var encodedUri = 'data:attachment/csv,' + encodeURI(csv);
       // $window.open(encodedUri);	
	
        var hiddenElement = document.createElement('a');
        hiddenElement.href = 'data:attachment/csv,' + encodeURI(csv);
        hiddenElement.download = title + '.csv';
        hiddenElement.click();
    }
});


//app.service('csvService', function(){});

app.service('downloadService', ['getDataService', 'csvService', '$q', '$rootScope', '$timeout', '$dialogs',
function(getDataService, csvService, $q, $rootScope, $timeout, $dialogs){    
    var progress;
    this.download = function(groupName, metadataDeferred){
	$dialogs.wait("", 0);
	progress = 0;
	var dataDeferred = getDataService.getData(groupName);	
	$q.all([dataDeferred, metadataDeferred]).then(function(deferredData){
	    var data = deferredData[0];
	    var metaData;
	    for(i in deferredData[1]){
		if(groupName == deferredData[1][i].groupName){
		    metaData = deferredData[1][i];
		    break;
		}
	    }
	    csvService.convertToCSV(metaData.title, data, metaData.ignore);
	});
	updateProgress();

    };
    function getProgress(){
	if(progress < 95){
	    progress = getDataService.getProgress();
	}else{
	    progress = csvService.getProgress();
	}
	return progress;
    }
    
    function updateProgress(){
	$timeout(function(){
	    if(getProgress() < 99){
		$rootScope.$broadcast('dialogs.wait.progress',{'msg': "",'progress': progress});
		updateProgress();
	    }else{
		$rootScope.$broadcast('dialogs.wait.progress',{'msg': "",'progress': 100});
		$timeout(function(){$rootScope.$broadcast('dialogs.wait.complete');}, 1000);
	    }
	},30);
    };
    
}]);

app.controller('listController', ['$scope', '$q', 'getListService', 'downloadService',
function($scope, $q, getListService, downloadService){
    $scope.dataSets = [];
    var metadataDeferred = getListService.getList();
    metadataDeferred.then(function(data){$scope.dataSets = data});
    
    $scope.launchDownload = function(groupName){
	downloadService.download(groupName, metadataDeferred);
    }
}]);

app.controller('singleController', ['$scope', '$q', 'getListService', 'downloadService', '$routeParams',
function($scope, $q, getListService, downloadService, $routeParams){
    $scope.title = $routeParams.title;

    getListService.promiseToHaveData().then(function(dataSets)
	{
	    for(i in dataSets){
		if(dataSets[i].title == $scope.title){
		    $scope.groupName = dataSets[i].groupName;
		    $scope.info = dataSets[i].info;
		    break;
		}
	    }
	});
    
    $scope.launchDownload = downloadService.launchDownload;
}
]);
				    
				    
