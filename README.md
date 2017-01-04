# Pre-Setup

This repository contains encrypted data that requires a specific private
key to decrypt. Either add the matching file `encrypted_data_bag_secret` to the 
root of this repository or regenerate the data using knife. Since the
progject is using `chef-solo`, a couple of plug-ins for `knife` are also
necessary:

```
cd chef
gem install knife-solo
gem install knife-solo_data_bag
openssl rand -base64 512 | tr -d '\r\n' > ../encrypted_data_bag_secret
knife solo data bag create passwords aws --secret-file ../encrypted-data-bag-secret
knife solo data bag create certs domain --secret-file ../encrypted-data-bag-secret
```

Where `aws` should have two items `aws_access_key_id` and `aws_secret_access_key`
specifying the AWS connection information and `domain` has two items `domain`
and `email` specifying the production server domain and email used for the
SSL certificate.

# Setup

1. Go into the `chef` directory and then do `vagrant up`.
