# -----------------------=[ ft_transcendence Makefile ]=---------------------- #

# some colors for the log msgs
GRN = \e[0;32m
RED = \e[1;31m
WHT = \e[1;37m
GRE = \e[37m
YLW = \e[1;93m
RST = \e[0m
MSGOPN = $(YLW)--(($(GRN)
MSGEND = $(YLW)))--$(RST)

# detect / set correct echo cmd
HOST = $(shell hostname)
ifeq ($(findstring wolfsburg,$(HOST)), wolfsburg)
	ECHO = echo
	ECHON = echo -n
else
	ECHO = echo -e
	ECHON = echo -en
endif

# logmsg makefile functions
log_msg_start = @$(ECHO) "\n$(MSGOPN) $(1) $(MSGEND)"
log_msg_mid = @$(ECHO) "$(MSGOPN) $(1) $(MSGEND)"
log_msg_end = @$(ECHO) "$(MSGOPN) $(1) $(MSGEND)\n"
log_msg_single = @$(ECHO) "\n$(MSGOPN) $(1) $(MSGEND)\n"

# output coloring
output_color_grey = @$(ECHON) "$(GRE)"
output_colr_reset =  @$(ECHON) "$(RST)"

DOCKER = docker

all:
	$(call log_msg_single,Launching ftr using docker compose..)
	$(DOCKER) compose up --build

dock-clean:
	$(call log_msg_start,Cleaning docker containers...)
	$(output_color_grey)
	-$(DOCKER) rm -f $$($(DOCKER) ps -qa)
	$(call log_msg_end,Done.)

# TODO add volume if we have decided on this
dock-fclean:
	$(call log_msg_start,Cleaning ALL runtime docker stuff...)
	$(output_color_grey)
	-$(DOCKER) rm -f $$($(DOCKER) ps -qa)
	# -$(DOCKER) volume rm -f $$($(DOCKER) volume ls -q)
	-$(DOCKER) network rm -f ftr-net
	$(call log_msg_end,Done.)

.phony: all dock-clean dock-fclean
