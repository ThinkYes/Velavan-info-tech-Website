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
                children : [
                    {
                        name:'Management 1',
                        active:true,
                        link:'view2'
                    },{
                        name:'Management 2',
                        active:true,
                        link:'view1'
                    }
                ]
            },{
                name:'Products',
                active:true,
                link:'view3'
            },{
                name:'Contact Us',
                active:true,
                link:'ContactUs'
            },{
                name:'Services',
                active:false,
                link:'Services'
            }
        ];
    }]);
