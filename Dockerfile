FROM ubuntu:focal
RUN apt-get -y update

RUN apt-get -y install ca-certificates curl gnupg software-properties-common gnupg-agent
RUN install -m 0755 -d /etc/apt/keyrings
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
RUN chmod a+r /etc/apt/keyrings/docker.gpg

RUN echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
   tee /etc/apt/sources.list.d/docker.list > /dev/null

RUN apt-get -y update

RUN apt-get -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin vim build-essential libkrb5-dev

#RUN curl -sL https://deb.nodesource.com/setup_18.x  | -E bash

RUN curl -sL https://deb.nodesource.com/setup_18.x -o /tmp/nodesource_setup.sh
RUN bash /tmp/nodesource_setup.sh

RUN apt-get -y install nodejs

WORKDIR /annoapi

COPY . .

RUN npm install