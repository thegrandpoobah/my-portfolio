include_recipe 'nodejs::nodejs_from_package'

package 'build-essential'
package 'git'
package 'zip'
package 'awscli'

nodejs_npm "webpack"

aws_secret = data_bag_item('passwords', 'aws')

magic_shell_environment 'SECRET' do
  value aws_secret['secret']
end
