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
	progress = 0.0;
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
                    progress = 5 + 90.0 * dataArray.length / idArray.length
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
        function JSONtoCSVHeading(keys, isMerged){
            var line = "";
            for(i in keys){
                if(line != "") line += ',';
                line += keys[i];
            }
	    if(isMerged){
		if(line != "") line += ',';
		line += "Image_url";
	    }
            return line;
        }
	/**
	 *obj, the data of one object in json format. 
	 *keys, an array of properties for obj.data
	 *isMerged. If the data is merged, then it contains media.
	 */
        function JSONtoCSV(obj, keys, isMerged, ) {
            var line = '';

	    var first = true;
            for (var i in keys) {
                if(first){
		    first = false;
		}else{
		    line += ',';
		}
                if (typeof obj.data[keys[i]] === 'undefined') {
                    //if the tuple doesn't have this property, then skip this.
                    continue;
                }

                var objEntry = "" + obj.data[keys[i]];
                objEntry = objEntry.replace(/"/g, '""');
		
                if (objEntry.indexOf(',') != -1) {
                    // if the string has commas in it, surround it in quotes 
                    line += '"' + objEntry + '"';
                }else {
                    line += objEntry;
                }

            }
	    if(isMerged){
		line += ",";
		if(obj.media){
		    for(var key in obj.media.images){
			console.log("+1");
			line += "\"" + obj.media.images[key].original + "\"";
		    }
		}
	    }

            return line;
        }
        var members = data;
        var csv = ""
        var keys = []; //the column titles
	var isMerged = false;
        for(i in members){
	    if(members[i].media){
		isMerged = true;
	    }
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

        csv += JSONtoCSVHeading(keys, isMerged) + "\n";
        for(i in members){
            progress = 95 + 10.0 * i / members.length;
            csv += JSONtoCSV(members[i], keys, isMerged) + "\n";
        }

	var blob = new Blob([csv], {type: "text/csv;charset=utf-8"});
	saveAs(blob, title + '.csv');
    }
});


//app.service('csvService', function(){});

app.service('downloadService', ['getDataService', 'csvService', '$q', '$rootScope', '$timeout', '$dialogs', function(getDataService, csvService, $q, $rootScope, $timeout, $dialogs){    
    var progress;
    this.download = function(groupName, metaData){
	$dialogs.wait("", 0);
	progress = 0;
	var dataDeferred = getDataService.getData(groupName);	
	dataDeferred.then(function(data){
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

app.controller('listController', ['$scope', '$q', 'getListService', 'downloadService', function($scope, $q, getListService, downloadService){
    $scope.dataSets = [];
    var metadataDeferred = getListService.getList();
    metadataDeferred.then(function(data){
	$scope.dataSets = data
		
    });
    
    $scope.launchDownload = function(groupName){
	for(i in $scope.dataSets){
	    if(groupName == $scope.dataSets[i].groupName){
		metaData = $scope.dataSets[i];
		break;
	    }
	}
	downloadService.download(groupName, metaData);
    }
}]);

app.controller('singleController', ['$scope', '$q', 'getListService', 'downloadService', '$routeParams', function($scope, $q, getListService, downloadService, $routeParams){
    $scope.title = $routeParams.title;
    var metaData;
    getListService.getList().then(function(dataSets){
	for(i in dataSets){
	    if(dataSets[i].title == $scope.title){
		$scope.groupName = dataSets[i].groupName;
		$scope.info = dataSets[i].info;
		metaData = dataSets[i];
		break;
	    }
	}
    });
    $scope.launchDownload = function(groupName){
	downloadService.download(groupName, metaData);
    }
}
]);
				    
				    
