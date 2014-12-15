angular.module('download', []).factory('downloadController', ['$q', function($q, $scope){ 

    var rootRef = new Firebase("http://cityknowledge.firebaseio.com");
    var progress;
    /**
    * @param groupName the name of group to be retrieved.
    * @return AsyncValue<object> {groupName:" " ,data:[] }
    *                               data is an array contains raw data in json format
    */
    function getData(groupName){
        var dataRef = rootRef.child("data");
        var deferred = $q.defer();

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
        
        getDataId(groupName).then(function(idArray){
            var dataArray = [];
            for(var index in idArray){
                dataRef.child(idArray[index]).once('value', function(dataSnapshot){
                    dataArray.push(dataSnapshot.val());
                    progress = 95.0 * dataArray.length / idArray.length
                    if(dataArray.length == idArray.length){
                        deferred.resolve({groupName: groupName,
                                          data: dataArray});
                    }
                });
            }
        });
        return deferred.promise;
    }
    function convertToCSV(groupData){

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

        var groupName = groupData.groupName;
        var members = groupData.data;
        var csv = ""
        var keys = []; //the column titles

        for(i in members){
            for(key in members[i].data){
                if($.inArray(key, keys) == -1){
                    keys.push(key);
                }
            }
        }

        csv += JSONtoCSVHeading(keys) + "\n";
        for(i in members){
            progress = 95 + 10.0 * i / members.length;
            csv += JSONtoCSV(members[i].data, keys, i) + "\n";
        }

        //var encodedUri = 'data:attachment/csv,' + encodeURI(csv);
       // $window.open(encodedUri);	
	
        var hiddenElement = document.createElement('a');
        hiddenElement.href = 'data:attachment/csv,' + encodeURI(csv);
        hiddenElement.download = groupName + '.csv';
        hiddenElement.click();
    }
    

    var download = function(groupName){
        progress = 0.0;
        getData(groupName).then(convertToCSV);
    };

    var getProgress = function(){
        return progress;
    }

    return {
        download: download,
        getProgress: getProgress
    };
}]);



