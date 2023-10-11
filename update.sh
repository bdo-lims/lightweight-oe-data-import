 rm oe_import.tar.gz
 docker build -t oe_import:latest .
 docker save oe_import:latest >oe_import.tar.gz
 scp oe_import.tar.gz 192.168.12.151:/home/itech/registry
