angular.module('download', []).factory('downloadController', ['$q', function($q){ 

    var rootRef = new Firebase("http://cityknowledge.firebaseio.com");

              /**                                                                                                                                                               
                 * @param formId the id of the form                                                                                                                               
                 * @return AsyncValue<formData>                                                                                                                                   
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

    function getData(groupName){
        var dataRef = rootRef.child("data");
        var deferred = $q.defer();
        
        getDataId(groupName).then(function(idArray){
            var dataArray = [];
            for(var index in idArray){
                dataRef.child(idArray[index]).once('value', function(dataSnapshot){
                    dataArray.push(dataSnapshot.val());
                    if(dataArray.length == idArray.length){
                        deferred.resolve({groupName: groupName,
                                          data: dataArray});
                    }
                });
            }
        });
        return deferred.promise;
    }

    function JSONtoCSVHeading(data){
        var line = "";
        for(key in data){
            if(line != "") line += ',';
            line += key;
        }
        return line;
    }

    function convertToCSV(groupData){
        var groupName = groupData.groupName;
        var members = groupData.data;
        var csv = ""
        headings = members[0].data;

        csv += JSONtoCSVHeading(headings) + "\n";
        for(i in members){
            csv += JSONtoCSV(members[i].data, headings, i) + "\n";
        }

        //var encodedUri = 'data:attachment/csv,' + encodeURI(csv);
       // $window.open(encodedUri);

        var hiddenElement = document.createElement('a');
        hiddenElement.href = 'data:attachment/csv,' + encodeURI(csv);
        hiddenElement.target = '_blank';
        hiddenElement.download = groupName + '.csv';
        hiddenElement.click();
    }

    function JSONtoCSV(json, keys, i) {
        //console.log(data);
        var line = '';
        for (var key in keys) {
            if(line != '') line += ',';
            if (typeof json[key] === 'undefined') {
                console.log(i.toString() + key);
                line += ',';
                continue;
            }
            var jsonEntry = "" + json[key];
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

    var download = function(groupName){
        getData(groupName).then(convertToCSV);
    };

    return {
        download: download
  };
}]);


angular.module('list',['download']).controller('listController', ['$scope', '$q', 'downloadController', function($scope, $q, downloadController){
    $scope.dataSets = ["PV MERGE May 2013 KM Flagstaff Pedestals",
                    "PV MERGE Mar 2013 KM Erratic Sculpture Coats of Arms",
                    "PV MERGE Mar 2013 KM Erratic Sculpture Crosses",
                    "Bardolino Edifici BL Aug 8 MERGE",
                    "PV MERGE Mar 2013 KM Erratic Sculpture Fragments"];

    $scope.num = 0;

    $scope.download = function(dataSetName){
        downloadController.download(dataSetName);
    }
}]);