var app = angular.module('list',['angulartics', 'angulartics.google.analytics', 'download','ui.bootstrap','dialogs','ngRoute']);

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
    this.promiseToHaveData = function() {
        var defer = $q.defer();

        $http.get('./metadata.json')
            .success(function(data) {
                console.log(data);
                defer.resolve(data);
            })
            .error(function() {
                defer.reject('could not find metadata.json');
            });
	
	return defer.promise;
    };
});


app.service('downloadService', ['downloadController','$rootScope', '$timeout', '$dialogs',
function(downloadController, $rootScope, $timeout, $dialogs){    
    this.launchDownload = function(dataSetName){
	$dialogs.wait("", 0);
	downloadController.download(dataSetName)
	updateProgress();
	
	function updateProgress(){
	    progress = downloadController.getProgress();
	    $timeout(function(){
		if(progress < 99){
		    $rootScope.$broadcast('dialogs.wait.progress',{'msg': "",'progress': progress});
		    updateProgress();
		}else{
		    $rootScope.$broadcast('dialogs.wait.progress',{'msg': "",'progress': 100});
		    $timeout(function(){$rootScope.$broadcast('dialogs.wait.complete');}, 1000);
		}
	    },30);
	};
    };
}]);

app.controller('listController', ['$scope', '$q', 'getListService', 'downloadService',
function($scope, $q, getListService, downloadService){
    $scope.dataSets = [];
    getListService.promiseToHaveData().then(function(data){$scope.dataSets = data});
    $scope.launchDownload = downloadService.launchDownload;
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
				    
				    
