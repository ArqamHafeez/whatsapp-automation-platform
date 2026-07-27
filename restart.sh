#!/bin/bash
echo "Starting WhatsApp Forward API..."
sudo service postgresql start
cd /mnt/c/Users/arqam/whatsapp-automation-platform
npm run start
