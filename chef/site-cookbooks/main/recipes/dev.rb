include_recipe 'nodejs'

package 'build-essential'
package 'git'
package 'zip'
package 'awscli'
package 'sqlite3'

nodejs_npm "webpack"

aws_secret = data_bag_item('passwords', 'aws')

magic_shell_environment 'AWS_ACCESS_KEY_ID' do
	value aws_secret['aws_access_key_id']
end

magic_shell_environment 'AWS_SECRET_ACCESS_KEY' do
	value aws_secret['aws_secret_access_key']
end
