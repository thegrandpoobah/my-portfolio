include_recipe 'nodejs'
include_recipe 'openssl'

package 'build-essential'
package 'git'
package 'zip'
package 'awscli'
package 'sqlite3'

# nodejs_npm "sqlite3"

aws_secret = data_bag_item('passwords', 'aws')

magic_shell_environment 'AWS_ACCESS_KEY_ID' do
	value aws_secret['aws_access_key_id']
end

magic_shell_environment 'AWS_SECRET_ACCESS_KEY' do
	value aws_secret['aws_secret_access_key']
end

openssl_x509 '/home/ubuntu/my-portfolio/data/localhost.crt' do
  common_name 'localhost'
  org 'My Portfolio'
  org_unit ''
  key_length 4096
  country 'CA'
end
