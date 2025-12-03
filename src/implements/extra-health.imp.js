// src/integrations/extra-health/ExtraHealthImp.js
import axios from 'axios';

export default class ExtraHealthImp {
  constructor() {}

  init() {
    this.base     = process.env.EXTRA_HEALTH_BASE_URL;    // https://api.1administration.com/v1
    this.username = process.env.EXTRA_HEALTH_USERNAME;
    this.password = process.env.EXTRA_HEALTH_PASSWORD;
    this.brokerId = process.env.EXTRA_HEALTH_BROKER_ID;
    this.agentId  = process.env.EXTRA_HEALTH_AGENT_ID;
    this.corpId   = process.env.EXTRA_HEALTH_CORP_ID;

    const missing = [];
    if (!this.base)     missing.push('EXTRA_HEALTH_BASE_URL');
    if (!this.username) missing.push('EXTRA_HEALTH_USERNAME');
    if (!this.password) missing.push('EXTRA_HEALTH_PASSWORD');
    if (!this.brokerId) missing.push('EXTRA_HEALTH_BROKER_ID');
    if (!this.agentId)  missing.push('EXTRA_HEALTH_AGENT_ID');
    if (!this.corpId)   missing.push('EXTRA_HEALTH_CORP_ID');
    if (missing.length) throw new Error(`Faltan variables: ${missing.join(', ')}`);

    this.http = axios.create({
      baseURL: `${this.base.replace(/\/+$/, '')}/${encodeURIComponent(this.brokerId)}`,
      auth: { username: this.username, password: this.password },
      // importante: no transformes si ya envías string
      transformRequest: [(data, headers) => data],
    });
  }

  // NO renombrar claves. Solo asegurar CORPID/AGENT y devolver STRING.
  buildMemberJsonString(input = {}) {
    const member = {
      ...(input || {}),
      CORPID: input?.CORPID ?? this.corpId,
      AGENT: input?.AGENT ?? this.agentId,
    };

    if (!member.CORPID)   throw new Error('CORPID es requerido');
    if (!member.AGENT)    throw new Error('AGENT es requerido');
    // LASTNAME: no asumimos casing; validamos si viene en alguna variante común
    // const last = member.LASTNAME ?? member.lastname ?? member.LastName;
    // if (!last) throw new Error('LASTNAME es requerido');

    return JSON.stringify(member);
  }

  // PUT /member/{id}.json con body = JSON STRING
  async updateUser(memberId, memberData) {
    this.init();
    if (!memberId) throw new Error('memberId es requerido');

    const body = this.buildMemberJsonString(memberData);
    const { data, status, statusText } = await this.http.post(
      `/member/${encodeURIComponent(memberId)}.json`,
      body,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (status < 200 || status >= 300) {
      throw new Error(`PUT ${status} ${statusText}: ${JSON.stringify(data)}`);
    }
    return data;
  }
  // PUT /member/{id}.json con body = JSON STRING
  async getUser(memberId) {
    this.init();
    if (!memberId) throw new Error('memberId es requerido');

    const body = this.buildMemberJsonString();
    const { data, status, statusText } = await this.http.get(
      `/member/${encodeURIComponent(memberId)}.json`,
      body,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (status < 200 || status >= 300) {
      throw new Error(`PUT ${status} ${statusText}: ${JSON.stringify(data)}`);
    }
    return data;
  }
  // Si también usas el POST de upsert:
  async createOrUpsertUser(memberData) {
    this.init();
    const body = this.buildMemberJsonString(memberData);
    const form = new URLSearchParams();
    form.set('member', body);
    const { data, status, statusText } = await this.http.post(
      '/member/0.json',
      form.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    if (status < 200 || status >= 300) {
      throw new Error(`POST ${status} ${statusText}: ${JSON.stringify(data)}`);
    }
    return data;
  }
}
