#!/bin/bash
# For upgrade just type ./upgradePubSubServer <version>
# This uploads NVM
VERSION=$1
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || (echo "nvm not found in $NVM_DIR, nvm is required to continue, Exiting!!!" ; exit 1 )

##### Navigate to push server directory #####
cd /opt/kaltura/pub-sub-server/
echo updating pub-sub-server to version $VERSION

##### Check if requested version was already pulled to the machine #####
if [ ! -d "$VERSION" ] ; then
    ##### Check if initial setup was already made following the deployment instructions #####
    if [ ! -L "$latest" ] ; then
        ##### Download the requested version release from git ##### 
        echo Try to download  https://github.com/kaltura/pub-sub-server/archive/$VERSION.tar.gz
        wget https://github.com/kaltura/pub-sub-server/archive/$VERSION.tar.gz
        
        ##### Unzip the source code #####
	echo try to unzip $VERSION.tar.gz
        tar -xvzf $VERSION.tar.gz
        if [[ ${VERSION:0:1} == "v" ]] ; then
            mv pub-sub-server-${VERSION:1} $VERSION
        else
            mv pub-sub-server-$VERSION $VERSION
        fi


        ##### Navigate to the downloaded version dir and install project pre-requisites #####
        cd $VERSION
        nvm install
        npm install --unsafe-perm
        cd ..
        
        ##### Copy config file from previous latest dir to the current version being installed ##### 
        cp -p /opt/kaltura/pub-sub-server/latest/config/config.ini /opt/kaltura/pub-sub-server/$VERSION/config/config.ini
        ##### Copy sh file from previous latest dir to the current version being installed ##### 
        cp -p /opt/kaltura/pub-sub-server/latest/bin/push-server.sh /opt/kaltura/pub-sub-server/$VERSION/bin/push-server.sh
        
        ##### Unlink previous version ##### 
        unlink /opt/kaltura/pub-sub-server/latest
        unlink /etc/init.d/kaltura_push
        
        ##### Link new version to latest and sync execution scripts #####
        ln -s /opt/kaltura/pub-sub-server/$VERSION /opt/kaltura/pub-sub-server/latest
        ln -s /opt/kaltura/pub-sub-server/latest/bin/push-server.sh /etc/init.d/kaltura_push
     
        ##### Delete downloaded zipped source files ##### 
        rm -rf /opt/kaltura/pub-sub-server/$VERSION.tar.gz
    else
        echo "No previous version found"
    fi
else
    echo $VERSION is already exist
fi
