module <%= enjin.name %> {
    class AuthService {
        pause: boolean;
        unwatch: any;

        constructor(
            protected enjin, 
            protected $http,
            protected $state, 
            protected $rootScope,
            protected Rest,
            protected Firebase,
            protected $filter,
            protected $ionicAuth,
            protected $ionicPush,
            protected $ionicModal,
            protected $firebaseAuth,
            protected $cordovaOauth
        ) {
            this.restoreSession();
            $rootScope.$on('$stateChangeError', (event, toState, toParams, fromState, fromParams, error) => {
                if (error === 'AUTH_REQUIRED') {
                    this.$state.go('login');
                } else {
                    throw error;
                }
            });
        }

        setHeader(token) {
            this.$http.defaults.headers.common.Authorization = token;
        }

        start() {
            this.enjin.auth = {
                instance: this.$firebaseAuth(),
                login: this.social.bind(this),
                logout: this.logout.bind(this),
                setSession: this.restoreSession.bind(this),
                firebase: this.firebase.bind(this)
            };
        }

        apiLogin(params, callback) {
            this.login(this.enjin.db.api.host + 'login', {
                username: params.email,
                token: params.uid
            }, (res) => {
                callback(res);
            });
        }

        tokenLogin(credential, callback) {
            this.enjin.auth.instance.$signInWithCredential(credential).then((firebaseUser) => {
                this.apiLogin({
                    email: firebaseUser.email,
                    uid: firebaseUser.uid
                }, callback);
            }).catch((error) => {
                console.log('Authentication failed:', error);
            });
        }

        social(type, callback) {
            if (window.cordova) {
                if (type === 'google') {
                    this.$cordovaOauth.google(this.enjin.google.id, ['email'], {
                        redirect_uri: this.enjin.oauthCallback
                    }).then((result) => {
                        this.tokenLogin(firebase.auth.GoogleAuthProvider.credential(result.id_token), callback);
                    });
                } else if (type === 'facebook') {
                    this.$cordovaOauth.facebook(this.enjin.facebook.id, ['email'], {
                        redirect_uri: this.enjin.oauthCallback
                    }).then((result) => {
                        this.tokenLogin(firebase.auth.FacebookAuthProvider.credential(result.access_token), callback);
                    });
                } else if (type === 'twitter') {
                    this.$cordovaOauth.twitter(this.enjin.twitter.id, this.enjin.twitter.secret, {
                        redirect_uri: this.enjin.oauthCallback
                    }).then((result) => {
                        this.tokenLogin(
                            firebase.auth.TwitterAuthProvider.credential(result.oauth_token, result.oauth_token_secret), 
                            callback
                        );
                    });
                } else if (type === 'github') {
                    this.$cordovaOauth.github(this.enjin.github.id, this.enjin.github.secret, ['email'], {
                        redirect_uri: this.enjin.oauthCallback
                    }).then((result) => {
                        this.tokenLogin(firebase.auth.GithubAuthProvider.credential(result.access_token), callback);
                    });
                }
            } else {
                this.enjin.auth.instance.$signInWithPopup(type).then((firebaseUser) => {
                    this.apiLogin({
                        email: firebaseUser.user.email,
                        uid: firebaseUser.user.uid
                    }, callback);
                }).catch((error) => {
                    console.log('Authentication failed:', error);
                });
            }
        }

        restoreSession() {
            if (!this.enjin.session && localStorage.getItem(this.enjin.name + 'Session')) {
                this.setSession(JSON.parse(localStorage.getItem(this.enjin.name + 'Session')));
            }
        }

        setSession(user) {
            if (user) {
                this.ionicAuth({email: user.user_email, password: user.user_token});
                this.enjin.session = this.$rootScope.session = user;
                this.setHeader(user.user_token);
                localStorage.setItem(this.enjin.name + 'Session', JSON.stringify(this.enjin.session));        
            }
        }

        ionicPush() {
            this.$ionicPush.register().then((t) => {
                return this.$ionicPush.saveToken(t);
            }).then((t) => {
                console.log('Token saved:', t.token);
            });
           
            this.$ionicModal.fromTemplateUrl('html/modal/notification.html', {
                scope: this.$rootScope,
                animation: 'slide-in-up',
                backdropClickToClose: true
            }).then((modal) => {
                this.$rootScope.notificationModal = modal;
            });
    
            this.$rootScope.closeNotification = () => {
                this.$rootScope.notificationModal.hide();
                this.$rootScope.updateApp(true);
            };

            this.$rootScope.$on('cloud:push:notification', (event, data) => {
                this.$rootScope.notification = {
                    title: data.message.title,
                    text: data.message.text
                };
                this.$rootScope.notificationModal.show();
            });
        }

        ionicAuth(data) {
            this.$ionicAuth.signup(data).then(() => {
                return this.$ionicAuth.login('basic', data);
            }, (err) => {
                for (var e of err.details) {
                    if (e === 'conflict_email') {
                        return this.$ionicAuth.login('basic', data);
                    } 
                }
            });
        }

        ionicRegister(data) {
            this.$ionicAuth.signup(data).then(() => {
                return true;
            }, (err) => {
                for (var e of err.details) {
                    console.log('Ionic Register Error: ', e);
                }
            });
        }

        firebase(params, callback) {
            this.enjin.auth.instance.$signInWithEmailAndPassword(params.username, params.password).then((firebaseUser) => {
                this.login(
                    this.enjin.db.api.host + 'login',
                    {
                        username: params.username,
                        password: params.password
                    },
                    (res) => {
                        if (res.success) {
                            callback(res);
                        } else {
                            console.error('Couldn\'t login after firebase');
                        }
                    }
                );
            }).catch((error) => {
                console.error('Authentication failed:', error);
                if (error.code === 'auth/user-not-found') {
                    this.login(
                        this.enjin.db.api.host + 'login',
                        {
                            username: params.username,
                            password: params.password
                        },
                        (res) => {
                            if (res.success) {
                                this.enjin.auth.instance.$createUserWithEmailAndPassword(
                                    params.username, 
                                    params.password
                                ).then((firebaseUser) => {
                                    this.login(
                                        this.enjin.db.api.host + 'login',
                                        {
                                            username: params.username,
                                            token: firebaseUser.uid
                                        },
                                        (res) => {
                                            if (res.success) {
                                                callback(res);
                                            } else {
                                                console.error('Couldn\'t login after account creation');
                                            }
                                        }
                                    );
                                }).catch((error) => {
                                    console.error('Error: ', error);
                                });
                            } else {
                                alert(res.data);
                            }
                        }
                    );
                } else if (error.code === 'auth/wrong-password') {
                    this.login(
                        this.enjin.db.api.host + 'login',
                        {
                            username: params.username,
                            password: params.password
                        },
                        (res) => {
                            if (res.success) {
                                alert('You have signed in with one of the social networks, please go back and use them.');
                            }
                        }
                    );
                }
            });
        }

        login(url, params, callback) {
            this.Rest.post(url, params).then((res) => {
                if (res.success === true) {
                    this.setSession(res.data);
                    if (typeof callback === 'function') {
                        callback(res);
                    } else {
                        console.log('Third parameter must be a callback function!');
                    }
                } else if (res.success === false && res.data.error && res.data.error.code === 1) {
                    if (confirm(res.data.error.message)) {
                        this.$state.go('register', {email: params.username});
                    }
                } else {
                    alert(res.data);
                }
            });    
        }

        logout() {
            if (confirm('Are you sure you wish to log out?')) {
                this.enjin.auth.instance.$signOut();
                this.$ionicAuth.logout();
                this.$state.go('login');
                localStorage.clear();
                delete this.enjin.session;
            }
        } 
    } 

    angular.module('<%= enjin.name %>').service('Auth', AuthService);
}