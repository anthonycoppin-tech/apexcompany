export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          cal_booking_id: string
          compte_rendu: string | null
          conseiller_id: string | null
          created_at: string
          debut: string
          fin: string
          id: string
          issue: Database["public"]["Enums"]["rdv_issue"] | null
          lead_id: string | null
          notes: string | null
          statut: Database["public"]["Enums"]["appointment_statut"]
          updated_at: string
        }
        Insert: {
          cal_booking_id: string
          compte_rendu?: string | null
          conseiller_id?: string | null
          created_at?: string
          debut: string
          fin: string
          id?: string
          issue?: Database["public"]["Enums"]["rdv_issue"] | null
          lead_id?: string | null
          notes?: string | null
          statut?: Database["public"]["Enums"]["appointment_statut"]
          updated_at?: string
        }
        Update: {
          cal_booking_id?: string
          compte_rendu?: string | null
          conseiller_id?: string | null
          created_at?: string
          debut?: string
          fin?: string
          id?: string
          issue?: Database["public"]["Enums"]["rdv_issue"] | null
          lead_id?: string | null
          notes?: string | null
          statut?: Database["public"]["Enums"]["appointment_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_conseiller_id_fkey"
            columns: ["conseiller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          apres: Json | null
          avant: Json | null
          created_at: string
          enregistrement_id: string | null
          id: string
          ip: unknown
          table_cible: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          apres?: Json | null
          avant?: Json | null
          created_at?: string
          enregistrement_id?: string | null
          id?: string
          ip?: unknown
          table_cible: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          apres?: Json | null
          avant?: Json | null
          created_at?: string
          enregistrement_id?: string | null
          id?: string
          ip?: unknown
          table_cible?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          created_at: string
          declencheur: string
          details: Json
          duree_ms: number | null
          entite_id: string | null
          entite_type: string | null
          id: string
          statut: Database["public"]["Enums"]["automation_statut"]
        }
        Insert: {
          created_at?: string
          declencheur: string
          details?: Json
          duree_ms?: number | null
          entite_id?: string | null
          entite_type?: string | null
          id?: string
          statut: Database["public"]["Enums"]["automation_statut"]
        }
        Update: {
          created_at?: string
          declencheur?: string
          details?: Json
          duree_ms?: number | null
          entite_id?: string | null
          entite_type?: string | null
          id?: string
          statut?: Database["public"]["Enums"]["automation_statut"]
        }
        Relationships: []
      }
      consents: {
        Row: {
          accorde: boolean
          created_at: string
          email: string | null
          id: string
          ip: unknown
          type: Database["public"]["Enums"]["consent_type"]
          user_id: string | null
          version_texte: string
        }
        Insert: {
          accorde: boolean
          created_at?: string
          email?: string | null
          id?: string
          ip?: unknown
          type: Database["public"]["Enums"]["consent_type"]
          user_id?: string | null
          version_texte: string
        }
        Update: {
          accorde?: boolean
          created_at?: string
          email?: string | null
          id?: string
          ip?: unknown
          type?: Database["public"]["Enums"]["consent_type"]
          user_id?: string | null
          version_texte?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discord_links: {
        Row: {
          derniere_sync: string | null
          discord_user_id: string
          discord_username: string | null
          id: string
          linked_at: string
          roles_attribues: Json
          user_id: string
        }
        Insert: {
          derniere_sync?: string | null
          discord_user_id: string
          discord_username?: string | null
          id?: string
          linked_at?: string
          roles_attribues?: Json
          user_id: string
        }
        Update: {
          derniere_sync?: string | null
          discord_user_id?: string
          discord_username?: string | null
          id?: string
          linked_at?: string
          roles_attribues?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discord_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discord_sync_queue: {
        Row: {
          action: Database["public"]["Enums"]["discord_action"]
          created_at: string
          erreur: string | null
          id: string
          prochain_essai: string
          role_id: string
          statut: Database["public"]["Enums"]["queue_statut"]
          tentatives: number
          traite_at: string | null
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["discord_action"]
          created_at?: string
          erreur?: string | null
          id?: string
          prochain_essai?: string
          role_id: string
          statut?: Database["public"]["Enums"]["queue_statut"]
          tentatives?: number
          traite_at?: string | null
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["discord_action"]
          created_at?: string
          erreur?: string | null
          id?: string
          prochain_essai?: string
          role_id?: string
          statut?: Database["public"]["Enums"]["queue_statut"]
          tentatives?: number
          traite_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discord_sync_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          created_at: string
          deadline_reponse: string | null
          id: string
          montant_cents: number
          motif: string | null
          payment_id: string
          provider_dispute_id: string
          statut: Database["public"]["Enums"]["dispute_statut"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline_reponse?: string | null
          id?: string
          montant_cents: number
          motif?: string | null
          payment_id: string
          provider_dispute_id: string
          statut?: Database["public"]["Enums"]["dispute_statut"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline_reponse?: string | null
          id?: string
          montant_cents?: number
          motif?: string | null
          payment_id?: string
          provider_dispute_id?: string
          statut?: Database["public"]["Enums"]["dispute_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      formations: {
        Row: {
          actif: boolean
          created_at: string
          description: string | null
          devise: string
          discord_role_id: string | null
          duree_acces_jours: number | null
          duree_semaines: number | null
          id: string
          modalite: Database["public"]["Enums"]["modalite_formation"]
          objectifs_pedagogiques: string | null
          ordre: number
          prerequis: string | null
          prix_cents: number
          slug: string
          titre: string
          type_produit: Database["public"]["Enums"]["type_produit"]
          updated_at: string
          volume_horaire: number | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description?: string | null
          devise?: string
          discord_role_id?: string | null
          duree_acces_jours?: number | null
          duree_semaines?: number | null
          id?: string
          modalite: Database["public"]["Enums"]["modalite_formation"]
          objectifs_pedagogiques?: string | null
          ordre?: number
          prerequis?: string | null
          prix_cents: number
          slug: string
          titre: string
          type_produit: Database["public"]["Enums"]["type_produit"]
          updated_at?: string
          volume_horaire?: number | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          description?: string | null
          devise?: string
          discord_role_id?: string | null
          duree_acces_jours?: number | null
          duree_semaines?: number | null
          id?: string
          modalite?: Database["public"]["Enums"]["modalite_formation"]
          objectifs_pedagogiques?: string | null
          ordre?: number
          prerequis?: string | null
          prix_cents?: number
          slug?: string
          titre?: string
          type_produit?: Database["public"]["Enums"]["type_produit"]
          updated_at?: string
          volume_horaire?: number | null
        }
        Relationships: []
      }
      inscriptions: {
        Row: {
          created_at: string
          date_debut: string
          date_fin_acces: string | null
          formateur_id: string | null
          formation_id: string
          id: string
          order_id: string | null
          statut: Database["public"]["Enums"]["inscription_statut"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_debut?: string
          date_fin_acces?: string | null
          formateur_id?: string | null
          formation_id: string
          id?: string
          order_id?: string | null
          statut?: Database["public"]["Enums"]["inscription_statut"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_debut?: string
          date_fin_acces?: string | null
          formateur_id?: string | null
          formation_id?: string
          id?: string
          order_id?: string | null
          statut?: Database["public"]["Enums"]["inscription_statut"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscriptions_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          emise_at: string
          id: string
          numero: string
          order_id: string
          pdf_url: string | null
        }
        Insert: {
          created_at?: string
          emise_at?: string
          id?: string
          numero: string
          order_id: string
          pdf_url?: string | null
        }
        Update: {
          created_at?: string
          emise_at?: string
          id?: string
          numero?: string
          order_id?: string
          pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          payload: Json
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          payload?: Json
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          payload?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          blocage: Database["public"]["Enums"]["blocage_trading"] | null
          converti_user_id: string | null
          created_at: string
          delai_objectif: Database["public"]["Enums"]["delai_objectif"] | null
          eligible: boolean | null
          email: string
          id: string
          niveau_trading: Database["public"]["Enums"]["niveau_trading"] | null
          nom: string | null
          prenom: string | null
          produit_recommande_id: string | null
          produit_souhaite_id: string | null
          prop_firm: Database["public"]["Enums"]["prop_firm_statut"] | null
          situation_pro: Database["public"]["Enums"]["situation_pro"] | null
          source: Database["public"]["Enums"]["lead_source"]
          statut: Database["public"]["Enums"]["lead_statut"]
          telephone: string | null
          tranche_age: Database["public"]["Enums"]["tranche_age"] | null
          tranche_budget: Database["public"]["Enums"]["tranche_budget"] | null
          updated_at: string
          user_id: string | null
          utm: Json
          zone_geo: Database["public"]["Enums"]["zone_geo"] | null
        }
        Insert: {
          assigned_to?: string | null
          blocage?: Database["public"]["Enums"]["blocage_trading"] | null
          converti_user_id?: string | null
          created_at?: string
          delai_objectif?: Database["public"]["Enums"]["delai_objectif"] | null
          eligible?: boolean | null
          email: string
          id?: string
          niveau_trading?: Database["public"]["Enums"]["niveau_trading"] | null
          nom?: string | null
          prenom?: string | null
          produit_recommande_id?: string | null
          produit_souhaite_id?: string | null
          prop_firm?: Database["public"]["Enums"]["prop_firm_statut"] | null
          situation_pro?: Database["public"]["Enums"]["situation_pro"] | null
          source?: Database["public"]["Enums"]["lead_source"]
          statut?: Database["public"]["Enums"]["lead_statut"]
          telephone?: string | null
          tranche_age?: Database["public"]["Enums"]["tranche_age"] | null
          tranche_budget?: Database["public"]["Enums"]["tranche_budget"] | null
          updated_at?: string
          user_id?: string | null
          utm?: Json
          zone_geo?: Database["public"]["Enums"]["zone_geo"] | null
        }
        Update: {
          assigned_to?: string | null
          blocage?: Database["public"]["Enums"]["blocage_trading"] | null
          converti_user_id?: string | null
          created_at?: string
          delai_objectif?: Database["public"]["Enums"]["delai_objectif"] | null
          eligible?: boolean | null
          email?: string
          id?: string
          niveau_trading?: Database["public"]["Enums"]["niveau_trading"] | null
          nom?: string | null
          prenom?: string | null
          produit_recommande_id?: string | null
          produit_souhaite_id?: string | null
          prop_firm?: Database["public"]["Enums"]["prop_firm_statut"] | null
          situation_pro?: Database["public"]["Enums"]["situation_pro"] | null
          source?: Database["public"]["Enums"]["lead_source"]
          statut?: Database["public"]["Enums"]["lead_statut"]
          telephone?: string | null
          tranche_age?: Database["public"]["Enums"]["tranche_age"] | null
          tranche_budget?: Database["public"]["Enums"]["tranche_budget"] | null
          updated_at?: string
          user_id?: string | null
          utm?: Json
          zone_geo?: Database["public"]["Enums"]["zone_geo"] | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converti_user_id_fkey"
            columns: ["converti_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_produit_recommande_fkey"
            columns: ["produit_recommande_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_produit_souhaite_id_fkey"
            columns: ["produit_souhaite_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          devise: string
          formation_id: string
          id: string
          lead_id: string | null
          montant_cents: number
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_order_id: string | null
          statut: Database["public"]["Enums"]["order_statut"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          devise?: string
          formation_id: string
          id?: string
          lead_id?: string | null
          montant_cents: number
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_order_id?: string | null
          statut?: Database["public"]["Enums"]["order_statut"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          devise?: string
          formation_id?: string
          id?: string
          lead_id?: string | null
          montant_cents?: number
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_order_id?: string | null
          statut?: Database["public"]["Enums"]["order_statut"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          erreur: string | null
          id: string
          payload: Json
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_event_id: string
          recu_at: string
          tentatives: number
          traite_at: string | null
          type: string
        }
        Insert: {
          erreur?: string | null
          id?: string
          payload?: Json
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_event_id: string
          recu_at?: string
          tentatives?: number
          traite_at?: string | null
          type: string
        }
        Update: {
          erreur?: string | null
          id?: string
          payload?: Json
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_event_id?: string
          recu_at?: string
          tentatives?: number
          traite_at?: string | null
          type?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          created_at: string
          devise: string
          id: string
          methode: string | null
          montant_cents: number
          order_id: string
          paid_at: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_payment_id: string | null
          statut: Database["public"]["Enums"]["payment_statut"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          devise?: string
          id?: string
          methode?: string | null
          montant_cents: number
          order_id: string
          paid_at?: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_payment_id?: string | null
          statut?: Database["public"]["Enums"]["payment_statut"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          devise?: string
          id?: string
          methode?: string | null
          montant_cents?: number
          order_id?: string
          paid_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_payment_id?: string | null
          statut?: Database["public"]["Enums"]["payment_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nom: string | null
          prenom: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          nom?: string | null
          prenom?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nom?: string | null
          prenom?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      propositions: {
        Row: {
          created_at: string
          devise: string
          expire_le: string | null
          formateur_id: string
          formation_id: string
          id: string
          lead_id: string | null
          montant_cents: number
          order_id: string | null
          statut: Database["public"]["Enums"]["proposition_statut"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          devise?: string
          expire_le?: string | null
          formateur_id: string
          formation_id: string
          id?: string
          lead_id?: string | null
          montant_cents: number
          order_id?: string | null
          statut?: Database["public"]["Enums"]["proposition_statut"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          devise?: string
          expire_le?: string | null
          formateur_id?: string
          formation_id?: string
          id?: string
          lead_id?: string | null
          montant_cents?: number
          order_id?: string | null
          statut?: Database["public"]["Enums"]["proposition_statut"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "propositions_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propositions_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propositions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propositions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propositions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          created_at: string
          demande_par: string | null
          id: string
          montant_cents: number
          motif: string | null
          payment_id: string
          statut: Database["public"]["Enums"]["refund_statut"]
          traite_at: string | null
          traite_par: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          demande_par?: string | null
          id?: string
          montant_cents: number
          motif?: string | null
          payment_id: string
          statut?: Database["public"]["Enums"]["refund_statut"]
          traite_at?: string | null
          traite_par?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          demande_par?: string | null
          id?: string
          montant_cents?: number
          motif?: string | null
          payment_id?: string
          statut?: Database["public"]["Enums"]["refund_statut"]
          traite_at?: string | null
          traite_par?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_demande_par_fkey"
            columns: ["demande_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_traite_par_fkey"
            columns: ["traite_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          formation_id: string
          id: string
          inscription_id: string | null
          periode_fin: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_subscription_id: string
          resiliation_demandee_le: string | null
          statut: Database["public"]["Enums"]["subscription_statut"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          formation_id: string
          id?: string
          inscription_id?: string | null
          periode_fin?: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_subscription_id: string
          resiliation_demandee_le?: string | null
          statut?: Database["public"]["Enums"]["subscription_statut"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          formation_id?: string
          id?: string
          inscription_id?: string | null
          periode_fin?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_subscription_id?: string
          resiliation_demandee_le?: string | null
          statut?: Database["public"]["Enums"]["subscription_statut"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suivi_notes: {
        Row: {
          contenu: string
          created_at: string
          formateur_id: string
          id: string
          inscription_id: string
          type: Database["public"]["Enums"]["suivi_note_type"]
          updated_at: string
          visible_client: boolean
        }
        Insert: {
          contenu: string
          created_at?: string
          formateur_id: string
          id?: string
          inscription_id: string
          type?: Database["public"]["Enums"]["suivi_note_type"]
          updated_at?: string
          visible_client?: boolean
        }
        Update: {
          contenu?: string
          created_at?: string
          formateur_id?: string
          id?: string
          inscription_id?: string
          type?: Database["public"]["Enums"]["suivi_note_type"]
          updated_at?: string
          visible_client?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "suivi_notes_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suivi_notes_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "inscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      est_mon_inscription: { Args: { i: string }; Returns: boolean }
      est_mon_lead: { Args: { l: string }; Returns: boolean }
      formateur_de_inscription: { Args: { i: string }; Returns: boolean }
      formateur_de_lead: { Args: { l: string }; Returns: boolean }
      has_role: {
        Args: { r: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_owner: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      renouveler_abonnement: {
        Args: {
          p_event_id: string
          p_event_type: string
          p_montant_cents?: number
          p_payload: Json
          p_provider: Database["public"]["Enums"]["payment_provider"]
          p_provider_payment_id?: string
          p_subscription_id: string
        }
        Returns: Json
      }
      revoquer_acces_expires: { Args: never; Returns: Json }
      stats_conversion: {
        Args: { depuis?: string }
        Returns: {
          gagnes: number
          leads: number
          rdv: number
          source: Database["public"]["Enums"]["lead_source"]
          taux_conversion: number
        }[]
      }
      traiter_paiement: {
        Args: {
          p_devise: string
          p_event_id: string
          p_event_type: string
          p_formation_id: string
          p_montant_cents: number
          p_payload: Json
          p_proposition_id?: string
          p_provider: Database["public"]["Enums"]["payment_provider"]
          p_provider_order_id: string
          p_provider_payment_id: string
          p_subscription_id?: string
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "client" | "formateur" | "branding" | "admin" | "owner"
      appointment_statut:
        | "planifie"
        | "confirme"
        | "honore"
        | "absent"
        | "annule"
        | "reporte"
      automation_statut: "succes" | "echec" | "ignore"
      blocage_trading:
        | "strategie"
        | "discipline"
        | "gestion_risque"
        | "prop_firm"
      consent_type: "cgv" | "confidentialite" | "cookies" | "marketing"
      delai_objectif: "immediat" | "mois_prochain" | "trois_mois"
      discord_action: "grant" | "revoke"
      dispute_statut: "ouvert" | "preuves_envoyees" | "gagne" | "perdu" | "clos"
      inscription_statut: "active" | "suspendue" | "terminee" | "remboursee"
      lead_source:
        | "instagram"
        | "youtube"
        | "tiktok"
        | "snapchat"
        | "direct"
        | "parrainage"
      lead_statut:
        | "nouveau"
        | "contacte"
        | "rdv"
        | "proposition"
        | "gagne"
        | "perdu"
      modalite_formation: "individuel" | "groupe"
      niveau_trading: "decouverte" | "debutant" | "intermediaire" | "avance"
      order_statut:
        | "brouillon"
        | "en_attente"
        | "payee"
        | "partielle"
        | "annulee"
        | "remboursee"
      payment_provider: "stripe" | "paypal"
      payment_statut: "en_attente" | "reussi" | "echoue" | "rembourse"
      prop_firm_statut: "non" | "en_challenge" | "oui"
      proposition_statut:
        | "brouillon"
        | "envoyee"
        | "acceptee"
        | "refusee"
        | "expiree"
      queue_statut:
        | "en_attente"
        | "en_cours"
        | "reussi"
        | "echoue"
        | "abandonne"
      rdv_issue: "honore" | "absent" | "annule"
      refund_statut: "demande" | "approuve" | "refuse" | "traite"
      situation_pro: "salarie" | "independant" | "etudiant" | "sans_emploi"
      subscription_statut: "active" | "impayee" | "resiliee" | "terminee"
      suivi_note_type: "objectif" | "observation" | "retour"
      tranche_age: "18_25" | "25_35" | "35_50" | "plus_50"
      tranche_budget: "500_1000" | "1000_2000" | "2000_5000" | "plus_5000"
      type_produit: "abonnement" | "accompagnement" | "formation"
      zone_geo: "europe" | "amerique" | "asie" | "oceanie" | "afrique"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["client", "formateur", "branding", "admin", "owner"],
      appointment_statut: [
        "planifie",
        "confirme",
        "honore",
        "absent",
        "annule",
        "reporte",
      ],
      automation_statut: ["succes", "echec", "ignore"],
      blocage_trading: [
        "strategie",
        "discipline",
        "gestion_risque",
        "prop_firm",
      ],
      consent_type: ["cgv", "confidentialite", "cookies", "marketing"],
      delai_objectif: ["immediat", "mois_prochain", "trois_mois"],
      discord_action: ["grant", "revoke"],
      dispute_statut: ["ouvert", "preuves_envoyees", "gagne", "perdu", "clos"],
      inscription_statut: ["active", "suspendue", "terminee", "remboursee"],
      lead_source: [
        "instagram",
        "youtube",
        "tiktok",
        "snapchat",
        "direct",
        "parrainage",
      ],
      lead_statut: [
        "nouveau",
        "contacte",
        "rdv",
        "proposition",
        "gagne",
        "perdu",
      ],
      modalite_formation: ["individuel", "groupe"],
      niveau_trading: ["decouverte", "debutant", "intermediaire", "avance"],
      order_statut: [
        "brouillon",
        "en_attente",
        "payee",
        "partielle",
        "annulee",
        "remboursee",
      ],
      payment_provider: ["stripe", "paypal"],
      payment_statut: ["en_attente", "reussi", "echoue", "rembourse"],
      prop_firm_statut: ["non", "en_challenge", "oui"],
      proposition_statut: [
        "brouillon",
        "envoyee",
        "acceptee",
        "refusee",
        "expiree",
      ],
      queue_statut: ["en_attente", "en_cours", "reussi", "echoue", "abandonne"],
      rdv_issue: ["honore", "absent", "annule"],
      refund_statut: ["demande", "approuve", "refuse", "traite"],
      situation_pro: ["salarie", "independant", "etudiant", "sans_emploi"],
      subscription_statut: ["active", "impayee", "resiliee", "terminee"],
      suivi_note_type: ["objectif", "observation", "retour"],
      tranche_age: ["18_25", "25_35", "35_50", "plus_50"],
      tranche_budget: ["500_1000", "1000_2000", "2000_5000", "plus_5000"],
      type_produit: ["abonnement", "accompagnement", "formation"],
      zone_geo: ["europe", "amerique", "asie", "oceanie", "afrique"],
    },
  },
} as const
