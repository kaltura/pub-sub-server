#!/bin/bash
#PRE-REQUISITES: NVM installed
# For upgrade just type ./upgradePubSubServer <version>
# This uploads NVM
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || (echo "nvm not found in $NVM_DIR, nvm is required to continue, Exiting!!!" ; exit 1 )

versionName="v"$1

##### Navigate to push server directory #####
cd /opt/kaltura/pub-sub-server/
echo updating pub-sub-server to version $versionName

##### Check if requested version was already pulled to the machine #####
if [ ! -d "$versionName" ] ; then
    ##### Check if initial setup was already made following the deployment instructions #####
    if [ -L "latest" ] ; then
        ##### Download the requested version release from git ##### 
        echo Try to download  https://github.com/kaltura/pub-sub-server/archive/$versionName.tar.gz
        wget https://github.com/kaltura/pub-sub-server/archive/$versionName.tar.gz
        
        ##### Unzip the source code #####
        echo try to unzip $versionName.tar.gz
        tar -xvzf $versionName.tar.gz
        mv pub-sub-server-$1 $versionName

        ##### Navigate to the downloaded version dir and install project pre-requisites #####
        cd $versionName
        nvm install
        npm install
        cd ..
        
        ##### Copy config file from previous latest dir to the current version being installed ##### 
        cp -p /opt/kaltura/pub-sub-server/latest/config/config.ini /opt/kaltura/pub-sub-server/$versionName/config/config.ini
        ##### Copy sh file from previous latest dir to the current version being installed ##### 
        cp -p /opt/kaltura/pub-sub-server/latest/bin/push-server.sh /opt/kaltura/pub-sub-server/$versionName/bin/push-server.sh
        
        ##### Unlink previous version ##### 
        unlink /opt/kaltura/pub-sub-server/latest
        unlink /etc/init.d/kaltura_push
        
        ##### Link new version to latest and sync execution scripts #####
        ln -s /opt/kaltura/pub-sub-server/$versionName /opt/kaltura/pub-sub-server/latest
        ln -s /opt/kaltura/pub-sub-server/latest/bin/push-server.sh /etc/init.d/kaltura_push
     
        ##### Delete downloaded zipped source files ##### 
        rm -rf /opt/kaltura/pub-sub-server/$versionName.tar.gz
    else
        echo "No previous version found"
    fi
else
    echo $versionName already exists
fi
