[![CircleCI](https://circleci.com/gh/thegrandpoobah/my-portfolio.svg?style=svg)](https://circleci.com/gh/thegrandpoobah/my-portfolio)

# Prerequisites

You must be running VirtualBox, Vagrant, ChefDK, and a couple plug-ins for this project:

* VirtualBox
* Vagrant 2.1.x
* ChefDK
* vagrant-berkshelf (`vagrant plugin install vagrant-berkshelf`)
* vagrant-vbguest (`vagrant plugin install vagrant-vbguest`)
* vagrant-fsnotify (`vagrant plugin install vagrant-fsnotify`)
* vagrant-omnibus (`vagrant plugin install vagrant-omnibus`)
* knife-solo (`cd chef && gem install knife-solo`)
* knife-solo_data_bag (`cd chef && gem install knife-solo_data_bag`)

# Setup

1. Clone Repository
2. You need to create the `encrypted_data_bag_secret` file. See section below.
3. `cd chef`
4. `vagrant up`
5. `vagrant ssh`

# Database Setup

To initialize a blank database, you need to run the migrations via the `db.js` command:

1. `node db.js init`
2. `node db.js migrate`

# Encrypted Data Bag Setup

This repository contains encrypted data that requires a specific private
key to decrypt. Either add the matching file `encrypted_data_bag_secret` to the 
root of this repository or regenerate the data using `knife`.

```
openssl rand -base64 512 | tr -d '\r\n' > ../encrypted_data_bag_secret
knife solo data bag create passwords aws --secret-file ../encrypted-data-bag-secret
```

Where `aws` should have two items `aws_access_key_id` and `aws_secret_access_key`
specifying the AWS connection information necessary for uploading artifacts to S3.
