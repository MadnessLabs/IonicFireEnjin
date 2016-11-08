/// <reference path="../../typings/index.d.ts"/>
declare var firebase;

module <%= enjin.name %> {
    class FireEnjinService {
        firebase: any;

        constructor(
            protected Firebase,
            protected Auth
        ) {
            // On Load
            this.Firebase.start();
            this.Auth.start();
        }
    }

    angular.module('<%= enjin.name %>').service('FireEnjin', FireEnjinService);
}
