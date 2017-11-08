#!/bin/bash
# For upgrade just type ./upgradePubSubServer <version>
# This uploads NVM
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || (echo "nvm not found in $NVM_DIR, nvm is required to continue, Exiting!!!" ; exit 1 )

##### Navigate to push server directory #####
cd /opt/kaltura/pub-sub-server/
echo updating pub-sub-server to version $1

##### Check if requested version was already pulled to the machine #####
if [ ! -d "$1" ] ; then
    ##### Check if initial setup was already made following the deployment instructions #####
    if [ -L "latest" ] ; then
        ##### Download the requested version release from git ##### 
        echo Try to download  https://github.com/kaltura/pub-sub-server/archive/$1.tar.gz
        wget https://github.com/kaltura/pub-sub-server/archive/$1.tar.gz
        
        ##### Unzip the source code #####
        echo try to unzip $1.tar.gz
        tar -xvzf $1.tar.gz
        if [[ ${1:0:1} == "v" ]] ; then
            mv pub-sub-server-${1:1} $1
        else
            mv pub-sub-server-$1 $1
        fi

        ##### Navigate to the downloaded version dir and install project pre-requisites #####
        cd $1
        nvm install
        npm install
        cd ..
        
        ##### Copy config file from previous latest dir to the current version being installed ##### 
        cp -p /opt/kaltura/pub-sub-server/latest/config/config.ini /opt/kaltura/pub-sub-server/$1/config/config.ini
        ##### Copy sh file from previous latest dir to the current version being installed ##### 
        cp -p /opt/kaltura/pub-sub-server/latest/bin/push-server.sh /opt/kaltura/pub-sub-server/$1/bin/push-server.sh
        
        ##### Unlink previous version ##### 
        unlink /opt/kaltura/pub-sub-server/latest
        unlink /etc/init.d/kaltura_push
        
        ##### Link new version to latest and sync execution scripts #####
        ln -s /opt/kaltura/pub-sub-server/$1 /opt/kaltura/pub-sub-server/latest
        ln -s /opt/kaltura/pub-sub-server/latest/bin/push-server.sh /etc/init.d/kaltura_push
     
        ##### Delete downloaded zipped source files ##### 
        rm -rf /opt/kaltura/pub-sub-server/$1.tar.gz
    else
        echo "No previous version found"
    fi
else
    echo $1 is already exist
fi
