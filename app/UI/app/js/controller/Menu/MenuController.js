'use strict';

velavan.website.App.controller('menuController', [
    '$scope',
    function($scope) {
        $scope.menuData = [
            {
                name:'Home',
                active:true,
                link:'view1'
            },{
                name:'About Us',
                active:true,
                link:'view2',
                child : [
                    {
                        name:'Management',
                        active:true,
                        link:''
                    }
                ]
            },{
                name:'Products',
                active:true,
                link:'view3'
            },{
                name:'Contact Us',
                active:true,
                link:'view4'
            },{
                name:'Services',
                active:false,
                link:'view5'
            }
        ];
    }]);
