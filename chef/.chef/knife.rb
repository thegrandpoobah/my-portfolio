cookbook_path             ["cookbooks", "site-cookbooks"]
node_path                 "nodes"
role_path                 "roles"
environment_path          "environments"
data_bag_path             "data_bags"
# encrypted_data_bag_secret "##"

knife[:berkshelf_path] = "cookbooks"
knife[:secret_file]    = File.expand_path('../../../encrypted_data_bag_secret', __FILE__)

Chef::Config[:ssl_verify_mode] = :verify_peer if defined? ::Chef

local_mode true
