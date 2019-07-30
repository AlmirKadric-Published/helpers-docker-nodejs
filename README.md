helpers-docker
==============
An opinionated set of docker helpers to empower a Node.js development environment.

At first use docker, is a very useful and easy to use tool. However after a while you find that as
your architecture gets larger and more complex you begin to need to automate parts of it. This is
where this project comes in. Rather than writing up a bunch of complex shell scripts (which can be a
nightmare to manage), this project helps you manage your docker framework using your projects native
tongue keeping your shell scripts lightweight, the way they're supposed to be.

This project extends docker functionality and will not break existing configurations. You can choose
the degree to which you use the available features as well as override them as you see fit.


Features & Design
-----------------
One of the opinionated features of this project is how the development environment is setup for
docker.

From our personal experience folder mounting and file watch/sync systems have been and still are
quite flaky. Inherently this is just a problem of attention as these kind of systems just do not
received the same love as something like a networking stack. For this reason we have chosen to avoid
these kinds of systems for the bulk of our development, because lets face it, you should be
debugging your application and not docker's mounting system.

Another issue that we have seen is how docker tends to have different behaviours on different
platforms. On windows and Linux you can setup routing to your containers with ease, however on macOS
it is virtually impossible without some hacks. This begins to pose issues when you begin to work on
multiple projects and technologies that hard enforces port requirements.

With that in mind this project can enable routing into your containers on a local setup allowing you
to develop your application locally. Once your application is ready to be tested as a container you
can bundle the application into an image and further test within a pure docker stack.


### Other Features
 - Modern ES8 structure with async/await support
 - Extendable & Overloadable CLI
 - Docker Operation Wrappers
   - docker
   - docker-compose
   - docker-machine
 - System Operation Wrappers
   - exec
   - sudo
   - ping
   - add/del route
   - sleep
 - A healthy set of default cli commands


Installation
------------
To install as a global helper:
```
npm install -g helpers-docker
```

To install as a project helper:
```
npm install --save helpers-docker
```


### OSX Routing Support
To enable host-to-container routing on OSX you will need to install [TunTap](http://tuntaposx.sourceforge.net/)
as well as the [docker-tuntap shim](https://github.com/AlmirKadric-Published/docker-tuntap-osx).

To install TunTap:
```
brew tap caskroom/cask
brew cask install tuntap
```

To install docker-tuntap shim:
```
npx docker-osx-tap-install
```

To uninstall docker-tuntap shim:
```
npx docker-osx-tap-uninstall
```


Usage
-----
Running the helpers:  
(**NOTE:** below commands and options can change depending on your overrides)
```
npx docker-helper -h

  Usage: docker-helper [options] [command]


  Options:

    -V, --version       output the version number
    -p, --path [value]  Path to environment configuration [CWD] (default: /Users/almirkadric/Projects/Personal/Templates/template-webapp-nodejs)
    -V, --version       output the version number
    -p, --path [value]  Path to environment configuration (default: /Users/almirkadric/Projects/Personal/Templates/template-webapp-nodejs)
    -h, --help          output usage information


  Commands:

    image-build   Build application container image
    image-tag     Tag the latest built image
    image-push    Push the latest built image to the registry
    image-clean   Delete the latest built image
    up            Starts up all services
    up-services   Starts up service containers
    up-app        Starts up application container
    add-routes    Create local system routes to connect directly to containers
    ps            Shows the status of all configured containers
    kill          Kills all configured containers
    rm            Removes all configured containers
```


Configuration
-------------
These helpers will pull in configuration from a number of sources and make them available to your
CLI action overloads as well as [docker-compose files as variables](https://docs.docker.com/compose/environment-variables/).

Currently this project will take configuration from the following sources:  
(In order of overloading priority)
 - helper defaults  
   (**NOTE:** not all options have defaults, check the list below)
 - environment variables
 - `.env` file configuration  
   (**NOTE:** this strays a bit from the docker-compose behaviour as it will override environment
   variables, this behaviour can be disabled via the `--no-force-env-file` option)
 - base helper constructor options
 - overloaded helper set values


### Docker compose file patterns
This project currently supports 2 `docker-compose`file  patterns. The standard single
`docker-compose.yml` file pattern. As well as a dual file pattern where your application and it's
services are split into 2 separate files `docker-compose.services.yml` & `docker-compose.app.yml`
(this pattern simplifies the starting of services individually from the application).

This project will automatically detect which pattern has been used and will populate the
`COMPOSE_FILES` array property. For the `up-services` action to work, the dual file pattern must be
used, otherwise your application will be started as well.

In the event you would like to separate environments, rather than changing the filenames we suggest
creating subfolders as each environment will most likely need its own `.env` file and helper
overloads.


### `.env` file
This is the simplest way to set configuration and is heavily encouraged as it is a `docker-compose`
feature. These helpers will also read this file and place its values onto the `process.env` object.
This allows you to use them from within any actions you have created or overloaded.

For more details [check here](https://docs.docker.com/compose/env-file/)


### helper class overloading
The helper class and its actions can be inherited and overloaded to change its behaviour. Take a
look at the [sample](./sample) folder for some examples of what could be done.


### Base configurable options
Here is a list of configuration the base helper requires and their default values:
 - `NODE_ENV`: (Default: None)
 - `PROJECT_NAME`: (Default: `name` property in your projects `package.json` file)
 - `PROJECT_VERSION`: (Default: `version` property in your projects `package.json` file)
 - `COMPOSE_PROJECT_NAME`: (Default: `${PROJECT_NAME}-${NODE_ENV}`)
 - `IMAGE_NAME`: (Default: `${COMPOSE_PROJECT_NAME}:${PROJECT_VERSION}`)
 - `IMAGE_REGISTRY`: The username or full url of the image registry against which we perform remote
   image operations. Needed to perform `image-tag` & `image-push` actions (Default: None)
 - `DOCKER_CLIENT_TIMEOUT`: How many milliseconds the docker client should wait for a response
   before giving up on the request to the docker daemon (Default: 5000)
 - `IP_RANGE`: Needed to enable host-to-container routing (Default: None)


TODO
----
 - Check if we can replace the tuntap shim with the experimental Docker network driver.  
   ([More information here](https://github.com/docker/for-mac/issues/155#issuecomment-320509769))
 - Create helpers for the new `docker swarm` and sample configuration
 - Create production helpers and sample configuration


License
-------
[MIT](LICENSE.md)