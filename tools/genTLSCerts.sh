#!/usr/bin/env bash

# create CA cert & nginx certs.. only if they do not exist yet!

function logmsg () {
  scriptname="$(echo $0 | sed 's/^\(.*\/\)\([a-zA-Z0-9_-]\+\.sh\)$/\2/')"
  if [[ $# -eq 2 && "$1" = "-e" ]]; then
    echo -e "\e[31m[ $scriptname ] $2\e[0m"
  elif [[ $# -eq 2 && "$1" = "-n" ]]; then
    echo -ne "\e[36m[ $scriptname ] $2\e[0m"
  elif [ $# -eq 0 ]; then
    echo -e "\e[36m[ $scriptname ]\e[0m"
  else
    echo -e "\e[36m[ $scriptname ] $1\e[0m"
  fi
}

if ! command -v openssl &> /dev/null; then
    logmsg -e "plz install 'openssl' first!"
    exit1
fi

# TODO set this from .env!
DOMAIN="localhost"

DAYS=365
ORG="TranscendenceInc"
OU="TranscendenceCA"
CN="TranscendenceCA"


if [[ ! -e ./ca-key.pem || ! -e ./ca-cert.pem ]]; then
    logmsg "Generating CA key and certificate..."

    # gen the rootCA with all the extensions fields set required by modern browsers.
    openssl req -x509 -newkey rsa:4096 -sha256 -days $DAYS \
    -nodes -keyout ca-key.pem -out ca-cert.pem \
    -subj "/O=$ORG/OU=$OU/CN=$CN" \
    -addext "keyUsage=critical,keyCertSign" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "subjectKeyIdentifier=hash"
fi

CN="$DOMAIN"

if [[ ! -e ./nginx-server-key.pem || ! -e ./nginx-server-cert.pem ]]; then
    logmsg "Generating Key and CSR for Nginx..."

    openssl req -nodes -newkey rsa:3072 \
        -keyout nginx-server-key.pem -out nginx-server-req.csr \
        -subj "/O=$ORG/OU=$OU/CN=$CN"

    # generate signed cert with the CSR (cert signing request). The `set_serial` arg
    # is for making the cert unique even if all other fields are the same. In
    # subsequent calls `-CAserial file.srl` should be used in order to increment
    # serial. This is only necessary for signing multiple certs with one csr?!
    logmsg "Generating & signing the final cert for Nginx.."

    openssl x509 -req -in nginx-server-req.csr -CA ca-cert.pem -CAkey ca-key.pem \
        -CAcreateserial -out nginx-server-cert.pem -days 365 -sha256 \
        -extfile <(cat <<EOF
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = DNS:$DOMAIN
EOF
    )

    # remove used CSR
    rm -f nginx-server-req.csr
fi
