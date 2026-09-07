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
          conseiller_id: string | null
          created_at: string
          debut: string
          fin: string
          id: string
          lead_id: string | null
          notes: string | null
          statut: Database["public"]["Enums"]["appointment_statut"]
          updated_at: string
        }
        Insert: {
          cal_booking_id: string
          conseiller_id?: string | null
          created_at?: string
          debut: string
          fin: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          statut?: Database["public"]["Enums"]["appointment_statut"]
          updated_at?: string
        }
        Update: {
          cal_booking_id?: string
          conseiller_id?: string | null
          created_at?: string
          debut?: string
          fin?: string
          id?: string
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
      coaching_sessions: {
        Row: {
          cal_booking_id: string | null
          coach_id: string | null
          compte_rendu: string | null
          created_at: string
          debut: string
          fin: string
          id: string
          inscription_id: string
          statut: Database["public"]["Enums"]["coaching_statut"]
          updated_at: string
        }
        Insert: {
          cal_booking_id?: string | null
          coach_id?: string | null
          compte_rendu?: string | null
          created_at?: string
          debut: string
          fin: string
          id?: string
          inscription_id: string
          statut?: Database["public"]["Enums"]["coaching_statut"]
          updated_at?: string
        }
        Update: {
          cal_booking_id?: string | null
          coach_id?: string | null
          compte_rendu?: string | null
          created_at?: string
          debut?: string
          fin?: string
          id?: string
          inscription_id?: string
          statut?: Database["public"]["Enums"]["coaching_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_sessions_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "inscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorte_coachs: {
        Row: {
          coach_id: string
          cohorte_id: string
          created_at: string
        }
        Insert: {
          coach_id: string
          cohorte_id: string
          created_at?: string
        }
        Update: {
          coach_id?: string
          cohorte_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohorte_coachs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohorte_coachs_cohorte_id_fkey"
            columns: ["cohorte_id"]
            isOneToOne: false
            referencedRelation: "cohortes"
            referencedColumns: ["id"]
          },
        ]
      }
      cohortes: {
        Row: {
          created_at: string
          date_debut: string
          date_fin: string | null
          discord_role_id: string | null
          id: string
          nom: string
          offre_id: string
          places_max: number
          statut: Database["public"]["Enums"]["cohorte_statut"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_debut: string
          date_fin?: string | null
          discord_role_id?: string | null
          id?: string
          nom: string
          offre_id: string
          places_max?: number
          statut?: Database["public"]["Enums"]["cohorte_statut"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_debut?: string
          date_fin?: string | null
          discord_role_id?: string | null
          id?: string
          nom?: string
          offre_id?: string
          places_max?: number
          statut?: Database["public"]["Enums"]["cohorte_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohortes_offre_id_fkey"
            columns: ["offre_id"]
            isOneToOne: false
            referencedRelation: "offres"
            referencedColumns: ["id"]
          },
        ]
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
      inscriptions: {
        Row: {
          cohorte_id: string | null
          created_at: string
          date_debut: string
          date_fin_acces: string | null
          id: string
          offre_id: string
          order_id: string | null
          statut: Database["public"]["Enums"]["inscription_statut"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cohorte_id?: string | null
          created_at?: string
          date_debut?: string
          date_fin_acces?: string | null
          id?: string
          offre_id: string
          order_id?: string | null
          statut?: Database["public"]["Enums"]["inscription_statut"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cohorte_id?: string | null
          created_at?: string
          date_debut?: string
          date_fin_acces?: string | null
          id?: string
          offre_id?: string
          order_id?: string | null
          statut?: Database["public"]["Enums"]["inscription_statut"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscriptions_cohorte_id_fkey"
            columns: ["cohorte_id"]
            isOneToOne: false
            referencedRelation: "cohortes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_offre_id_fkey"
            columns: ["offre_id"]
            isOneToOne: false
            referencedRelation: "offres"
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
          converti_user_id: string | null
          created_at: string
          email: string
          id: string
          nom: string | null
          offre_recommandee_id: string | null
          prenom: string | null
          source: Database["public"]["Enums"]["lead_source"]
          statut: Database["public"]["Enums"]["lead_statut"]
          telephone: string | null
          updated_at: string
          utm: Json
        }
        Insert: {
          assigned_to?: string | null
          converti_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          nom?: string | null
          offre_recommandee_id?: string | null
          prenom?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          statut?: Database["public"]["Enums"]["lead_statut"]
          telephone?: string | null
          updated_at?: string
          utm?: Json
        }
        Update: {
          assigned_to?: string | null
          converti_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          nom?: string | null
          offre_recommandee_id?: string | null
          prenom?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          statut?: Database["public"]["Enums"]["lead_statut"]
          telephone?: string | null
          updated_at?: string
          utm?: Json
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
            foreignKeyName: "leads_offre_recommandee_fkey"
            columns: ["offre_recommandee_id"]
            isOneToOne: false
            referencedRelation: "offres"
            referencedColumns: ["id"]
          },
        ]
      }
      offres: {
        Row: {
          actif: boolean
          created_at: string
          description: string | null
          devise: string
          duree_semaines: number | null
          id: string
          nb_echeances_max: number
          objectifs_pedagogiques: string | null
          ordre: number
          paiement_echelonne_possible: boolean
          prerequis: string | null
          prix_cents: number
          slug: string
          titre: string
          updated_at: string
          volume_horaire: number | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description?: string | null
          devise?: string
          duree_semaines?: number | null
          id?: string
          nb_echeances_max?: number
          objectifs_pedagogiques?: string | null
          ordre?: number
          paiement_echelonne_possible?: boolean
          prerequis?: string | null
          prix_cents: number
          slug: string
          titre: string
          updated_at?: string
          volume_horaire?: number | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          description?: string | null
          devise?: string
          duree_semaines?: number | null
          id?: string
          nb_echeances_max?: number
          objectifs_pedagogiques?: string | null
          ordre?: number
          paiement_echelonne_possible?: boolean
          prerequis?: string | null
          prix_cents?: number
          slug?: string
          titre?: string
          updated_at?: string
          volume_horaire?: number | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          cohorte_id: string | null
          created_at: string
          devise: string
          echelonne: boolean
          id: string
          lead_id: string | null
          montant_cents: number
          offre_id: string
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_order_id: string | null
          statut: Database["public"]["Enums"]["order_statut"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cohorte_id?: string | null
          created_at?: string
          devise?: string
          echelonne?: boolean
          id?: string
          lead_id?: string | null
          montant_cents: number
          offre_id: string
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_order_id?: string | null
          statut?: Database["public"]["Enums"]["order_statut"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cohorte_id?: string | null
          created_at?: string
          devise?: string
          echelonne?: boolean
          id?: string
          lead_id?: string | null
          montant_cents?: number
          offre_id?: string
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_order_id?: string | null
          statut?: Database["public"]["Enums"]["order_statut"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_cohorte_id_fkey"
            columns: ["cohorte_id"]
            isOneToOne: false
            referencedRelation: "cohortes"
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
            foreignKeyName: "orders_offre_id_fkey"
            columns: ["offre_id"]
            isOneToOne: false
            referencedRelation: "offres"
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
      payment_schedules: {
        Row: {
          created_at: string
          date_prevue: string
          id: string
          montant_cents: number
          numero_echeance: number
          order_id: string
          payment_id: string | null
          relances_envoyees: number
          statut: Database["public"]["Enums"]["echeance_statut"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_prevue: string
          id?: string
          montant_cents: number
          numero_echeance: number
          order_id: string
          payment_id?: string | null
          relances_envoyees?: number
          statut?: Database["public"]["Enums"]["echeance_statut"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_prevue?: string
          id?: string
          montant_cents?: number
          numero_echeance?: number
          order_id?: string
          payment_id?: string | null
          relances_envoyees?: number
          statut?: Database["public"]["Enums"]["echeance_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
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
      presences: {
        Row: {
          created_at: string
          duree_minutes: number | null
          id: string
          inscription_id: string
          present: boolean
          saisi_par: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duree_minutes?: number | null
          id?: string
          inscription_id: string
          present?: boolean
          saisi_par?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duree_minutes?: number | null
          id?: string
          inscription_id?: string
          present?: boolean
          saisi_par?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presences_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presences_saisi_par_fkey"
            columns: ["saisi_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presences_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
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
      replays: {
        Row: {
          created_at: string
          disponible_jusqu_au: string | null
          duree_secondes: number | null
          id: string
          provider: string
          provider_asset_id: string
          publie: boolean
          session_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          disponible_jusqu_au?: string | null
          duree_secondes?: number | null
          id?: string
          provider: string
          provider_asset_id: string
          publie?: boolean
          session_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          disponible_jusqu_au?: string | null
          duree_secondes?: number | null
          id?: string
          provider?: string
          provider_asset_id?: string
          publie?: boolean
          session_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "replays_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replays_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          coach_id: string | null
          cohorte_id: string
          created_at: string
          debut: string
          fin: string
          id: string
          lien_discord: string | null
          statut: Database["public"]["Enums"]["session_statut"]
          titre: string
          type: Database["public"]["Enums"]["session_type"]
          updated_at: string
        }
        Insert: {
          coach_id?: string | null
          cohorte_id: string
          created_at?: string
          debut: string
          fin: string
          id?: string
          lien_discord?: string | null
          statut?: Database["public"]["Enums"]["session_statut"]
          titre: string
          type?: Database["public"]["Enums"]["session_type"]
          updated_at?: string
        }
        Update: {
          coach_id?: string | null
          cohorte_id?: string
          created_at?: string
          debut?: string
          fin?: string
          id?: string
          lien_discord?: string | null
          statut?: Database["public"]["Enums"]["session_statut"]
          titre?: string
          type?: Database["public"]["Enums"]["session_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_cohorte_id_fkey"
            columns: ["cohorte_id"]
            isOneToOne: false
            referencedRelation: "cohortes"
            referencedColumns: ["id"]
          },
        ]
      }
      suivi_notes: {
        Row: {
          coach_id: string
          contenu: string
          created_at: string
          id: string
          inscription_id: string
          type: Database["public"]["Enums"]["suivi_note_type"]
          updated_at: string
          visible_client: boolean
        }
        Insert: {
          coach_id: string
          contenu: string
          created_at?: string
          id?: string
          inscription_id: string
          type?: Database["public"]["Enums"]["suivi_note_type"]
          updated_at?: string
          visible_client?: boolean
        }
        Update: {
          coach_id?: string
          contenu?: string
          created_at?: string
          id?: string
          inscription_id?: string
          type?: Database["public"]["Enums"]["suivi_note_type"]
          updated_at?: string
          visible_client?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "suivi_notes_coach_id_fkey"
            columns: ["coach_id"]
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
      coach_de_cohorte: { Args: { c: string }; Returns: boolean }
      coach_de_inscription: { Args: { i: string }; Returns: boolean }
      coach_de_session: { Args: { s: string }; Returns: boolean }
      est_inscrit_cohorte: { Args: { c: string }; Returns: boolean }
      est_inscrit_session: { Args: { s: string }; Returns: boolean }
      est_mon_inscription: { Args: { i: string }; Returns: boolean }
      has_role: {
        Args: { r: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_owner: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
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
    }
    Enums: {
      app_role: "client" | "coach" | "branding" | "admin" | "owner"
      appointment_statut:
        | "planifie"
        | "confirme"
        | "honore"
        | "absent"
        | "annule"
        | "reporte"
      automation_statut: "succes" | "echec" | "ignore"
      coaching_statut: "planifiee" | "honoree" | "absente" | "annulee"
      cohorte_statut:
        | "brouillon"
        | "ouverte"
        | "complete"
        | "en_cours"
        | "terminee"
      consent_type: "cgv" | "confidentialite" | "cookies" | "marketing"
      discord_action: "grant" | "revoke"
      dispute_statut: "ouvert" | "preuves_envoyees" | "gagne" | "perdu" | "clos"
      echeance_statut: "a_venir" | "due" | "payee" | "echouee" | "annulee"
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
      order_statut:
        | "brouillon"
        | "en_attente"
        | "payee"
        | "partielle"
        | "annulee"
        | "remboursee"
      payment_provider: "stripe" | "paypal"
      payment_statut: "en_attente" | "reussi" | "echoue" | "rembourse"
      queue_statut:
        | "en_attente"
        | "en_cours"
        | "reussi"
        | "echoue"
        | "abandonne"
      refund_statut: "demande" | "approuve" | "refuse" | "traite"
      session_statut: "planifiee" | "en_cours" | "terminee" | "annulee"
      session_type: "live" | "call_groupe"
      suivi_note_type: "objectif" | "observation" | "retour"
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
      app_role: ["client", "coach", "branding", "admin", "owner"],
      appointment_statut: [
        "planifie",
        "confirme",
        "honore",
        "absent",
        "annule",
        "reporte",
      ],
      automation_statut: ["succes", "echec", "ignore"],
      coaching_statut: ["planifiee", "honoree", "absente", "annulee"],
      cohorte_statut: [
        "brouillon",
        "ouverte",
        "complete",
        "en_cours",
        "terminee",
      ],
      consent_type: ["cgv", "confidentialite", "cookies", "marketing"],
      discord_action: ["grant", "revoke"],
      dispute_statut: ["ouvert", "preuves_envoyees", "gagne", "perdu", "clos"],
      echeance_statut: ["a_venir", "due", "payee", "echouee", "annulee"],
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
      queue_statut: ["en_attente", "en_cours", "reussi", "echoue", "abandonne"],
      refund_statut: ["demande", "approuve", "refuse", "traite"],
      session_statut: ["planifiee", "en_cours", "terminee", "annulee"],
      session_type: ["live", "call_groupe"],
      suivi_note_type: ["objectif", "observation", "retour"],
    },
  },
} as const
