FROM node:12.16.1

RUN apt-get -yqq update && apt-get -y install apt-transport-https \
    ca-certificates \
    curl \
    gnupg-agent \
    software-properties-common
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | apt-key add -

RUN apt-key fingerprint 0EBFCD88

RUN add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/debian \
   $(lsb_release -cs) \
   stable"

RUN apt-get -y update
RUN apt-get -y install docker-ce docker-ce-cli containerd.io vim
WORKDIR /annoapi

COPY . .

RUN npm install
