include_recipe 'nodejs'
include_recipe 'monit'
include_recipe 'openssl'

package 'zip'
package 'sqlite3'

openssl_x509 '/var/db/localhost.crt' do
  common_name 'localhost'
  org 'My Portfolio'
  org_unit ''
  key_length 4096
  country 'CA'
end
